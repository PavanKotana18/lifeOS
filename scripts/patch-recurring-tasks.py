from pathlib import Path
import sys

p = Path("src/db.ts")
s = p.read_text()

start_marker = "    async toggleCompleted(id, completed) {"
end_marker = "\n  },\n  settings:"

start = s.find(start_marker)
if start < 0:
    sys.exit("PATCH FAILED: method start not found")

end = s.find(end_marker, start + len(start_marker))
if end < 0:
    sys.exit("PATCH FAILED: settings boundary after method not found")

replacement = """    async toggleCompleted(id, completed) {
      await db.transaction('rw', db.tasks, async () => {
        const task = await db.tasks.get(id);
        if (!task) return;

        if (!completed) {
          if (task.completed) {
            await db.tasks.update(id, {
              completed: false,
              completedAt: undefined,
              updatedAt: new Date().toISOString()
            });
          }
          return;
        }

        if (task.recurring && task.recurring !== 'None') {
          const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(task.dueDate);
          if (!match) throw new Error('Invalid recurring task due date');

          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          const nextDate = new Date(Date.UTC(year, month - 1, day));

          if (
            nextDate.getUTCFullYear() !== year ||
            nextDate.getUTCMonth() !== month - 1 ||
            nextDate.getUTCDate() !== day
          ) {
            throw new Error('Invalid recurring task due date');
          }

          if (task.recurring === 'Daily') {
            nextDate.setUTCDate(nextDate.getUTCDate() + 1);
          } else if (task.recurring === 'Weekly') {
            nextDate.setUTCDate(nextDate.getUTCDate() + 7);
          } else if (task.recurring === 'Monthly') {
            const originalDay = nextDate.getUTCDate();
            nextDate.setUTCDate(1);
            nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
            const lastDay = new Date(Date.UTC(
              nextDate.getUTCFullYear(),
              nextDate.getUTCMonth() + 1,
              0
            )).getUTCDate();
            nextDate.setUTCDate(Math.min(originalDay, lastDay));
          } else {
            throw new Error('Unsupported recurrence frequency');
          }

          const nextDueDate = [
            nextDate.getUTCFullYear(),
            String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
            String(nextDate.getUTCDate()).padStart(2, '0')
          ].join('-');

          const nextTaskId = `rec_${task.id}_${nextDueDate}`;
          if (!(await db.tasks.get(nextTaskId))) {
            await db.tasks.add({
              id: nextTaskId,
              title: task.title,
              description: task.description,
              dueDate: nextDueDate,
              dueTime: task.dueTime,
              priority: task.priority,
              category: task.category,
              notes: task.notes,
              recurring: task.recurring,
              completed: false,
              createdAt: new Date().toISOString()
            });
          }
        }

        if (!task.completed) {
          const now = new Date().toISOString();
          await db.tasks.update(id, {
            completed: true,
            completedAt: now,
            updatedAt: now
          });
        }
      });
    }"""

new = s[:start] + replacement + s[end:]

# Verify the replacement before modifying the file
check_start = new.find(start_marker)
check_end = new.find(end_marker, check_start + len(start_marker))
if check_start < 0 or check_end < 0:
    sys.exit("PATCH FAILED: resulting method boundaries invalid")

method = new[check_start:check_end]
required = [
    "db.transaction('rw', db.tasks",
    "rec_${task.id}_${nextDueDate}",
    "Invalid recurring task due date",
    "await db.tasks.add({"
]
for item in required:
    if item not in method:
        sys.exit("PATCH FAILED: missing required implementation: " + item)

if "Math.random" in method or "Date.now()" in method:
    sys.exit("PATCH FAILED: old random ID logic remains")

p.write_text(new)
print("PATCH APPLIED: exact method boundaries verified")
