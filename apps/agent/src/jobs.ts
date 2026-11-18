/** Background jobs: history retention, daily-limit reminders, weekly summary. */
import notifier from "node-notifier";
import { MINUTE, addDays, aggregateWeek, formatMinutes, formatTotal, startOfDay, startOfWeek, toISODate } from "@tempo/shared";
import type { Store } from "./db.ts";
import type { Tracker } from "./tracker.ts";

function notify(title: string, message: string) {
  notifier.notify({ title, message, appID: "Tempo", sound: false, wait: false }, (err) => {
    if (err) console.error("[notify]", err.message);
  });
}

export function startJobs(store: Store, tracker: Tracker) {
  let lastRetention = 0;

  const run = () => {
    const now = Date.now();
    const s = store.getSettings();

    // 1. Retention — at most once an hour
    if (s.retentionDays && now - lastRetention > 60 * MINUTE) {
      lastRetention = now;
      const removed = store.deleteBefore(addDays(startOfDay(now), -s.retentionDays));
      if (removed) console.log(`[retention] removed ${removed} old spans`);
    }

    // 2. Daily limit reminders — once per item per day
    if (s.limitReminders) {
      tracker.flush();
      const day = startOfDay(now);
      const today = toISODate(day);
      const limited = store.items().filter((i) => i.dailyLimitMinutes && !i.excluded);
      if (limited.length) {
        const spans = store.spansBetween(day, now);
        for (const item of limited) {
          const key = `notified:${today}:${item.id}`;
          if (store.getKV(key)) continue;
          const used = spans
            .filter((sp) => sp.itemId === item.id)
            .reduce((t, sp) => t + (Math.min(sp.end, now) - Math.max(sp.start, day)), 0) / MINUTE;
          if (used >= item.dailyLimitMinutes!) {
            store.setKV(key, "1");
            notify(`${item.name}: daily limit reached`, `You've spent ${formatMinutes(used)} today — your limit is ${formatMinutes(item.dailyLimitMinutes!)}.`);
          }
        }
      }
    }

    // 3. Weekly summary — on the chosen weekday/hour, about the week that just ended
    if (s.weeklySummary) {
      const d = new Date(now);
      if (d.getDay() === s.weeklySummary.day && d.getHours() === s.weeklySummary.hour) {
        const thisWeek = startOfWeek(now, s.weekStartsOn);
        const lastWeek = addDays(thisWeek, -7);
        const key = `weekly:${toISODate(lastWeek)}`;
        if (!store.getKV(key)) {
          store.setKV(key, "1");
          const w = aggregateWeek(store.items(), store.spansBetween(addDays(lastWeek, -7), thisWeek), lastWeek, thisWeek);
          if (w.totalMinutes > 0) {
            const top = w.items.slice(0, 3).map((i) => i.name).join(", ");
            notify(`Your week: ${formatTotal(w.totalMinutes)} on screen`, `${w.summary.split(" — ")[0]}. Most used: ${top}.`);
          }
        }
      }
    }
  };

  setTimeout(run, 5_000);
  return setInterval(run, MINUTE);
}
