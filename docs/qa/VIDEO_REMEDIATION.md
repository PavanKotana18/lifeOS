# Video-driven remediation

The owner recording runs 4m21.55s. The rejected APK is versionCode 1000005 at aeccca512f56e72ecab73c4992de53c18c696dff. The recovery checkpoint is checkpoint/video-remediation-input and includes the two verification-only follow-ups. The original feature/experience-reconstruction ref remains available.

## Owner recording observations

| Time | Visible behavior | Targeted change |
| --- | --- | --- |
| 3:53–4:01 | Repeated movement between Today, Money, and Plan, with neighboring content exposed while the tab selection catches up. | Move two opaque panels along a single clipped track. Update the indicator from the drag and share its settlement clock with the track. |
| About 4:12.6 and 4:17 | Tasks → Habits and Habits → Goals expose overlapping Plan headings. | Switch the nested destination inside the same primary section without compositing two Plan headers. |
| 4:10–4:18 | Task has compact presets and Habit and Goal show taller stacks of differently shaped controls. The keyboard appears during composer opening. | Use matching quick-action tiles and named sections. Focus the composer without opening the keyboard. Keep the action rail viewport-aware. |
| About 1:04–1:30, 1:54–2:33, and 2:39–2:52 | Savings, transaction and scheduled composers show different densities and settings layouts. | Lead with the Money amount or name. Group secondary currency, account, category, date and notes fields. Keep required savings and scheduled dates visible. |
| About 3:27–3:42 | The central recording area is black. Current evidence resumes to normal app use. | Keep secure-screen policy. The recording alone cannot distinguish a protected surface from another cause of capture blanking. |

Motion tests use synthetic fixtures and record actual browser compositor frames. The Android recording is the reproduction guide, not a controlled benchmark. App source changes preserve ledger and encrypted-store logic. Browser bridge tests and Android runtime testing are separate evidence.

The review evidence lives in %LOCALAPPDATA%/LifeOS/checkpoints/video-remediation. It includes matched captures, screen bounds and pacing measurements, the shared composer comparison, and the choice-sheet and full regression reports.
