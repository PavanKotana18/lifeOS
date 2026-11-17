# Mission 06: Safe LifeOS emulator optimization

Date: 2026-11-17 (Asia/Kolkata)
Branch: `local/lifeos-debug-isolated`

## Current diagnostics

- Windows 11 build 26200; Intel Core i5-8265U, 4 cores / 8 logical processors.
- RAM: 11.88 GB total, 5.68 GB available after the orphaned QEMU process exited.
  CPU load was about 30% at that sample. Top working sets were VS Code (0.35
  GB), Brave (0.33 GB), Memory Compression (0.23 GB), and Windows Defender
  (0.20 GB). No user process was stopped.
- Storage: C: has 153.23 GB free; D: has 731.92 GB free. The 238.5 GB SSD and
  931.5 GB HDD both report Healthy / OK.
- Power plan is Balanced. Current WMI battery readings report AC offline,
  discharging, 35 mWh remaining of 35,355 mWh full capacity (about 0.1%), and
  Win32_Battery reports 0% estimated charge. The `Critical` field is false, but
  the remaining capacity is too low to treat as a safe emulator power source.
- WHPX remains available. The LifeOS-QA AVD remains registered on D: and no
  emulator process is running now.

## Shutdown evidence

Windows Event Log 6008 records the previous shutdown at **2026-11-17 20:28:39**
as unexpected; Kernel-Power 41 was logged at 20:29:19. Event 41 has bugcheck
code 0, power-button timestamp 0, and WHEA boot error count 0. There is no
matching planned shutdown event 1074 or WHEA-Logger event in the inspected
interval.

The records do not establish the cause. Battery depletion is a plausible risk
given the current 0% / no-AC reading, but it is not proven to be the state at
20:28. No live ACPI temperature sensor data was returned; the thermal-zone
records at startup contain threshold metadata, not a measured overheating
event. A processor-firmware frequency-limit warning (Kernel-Processor-Power
37) occurred at 20:30:35, after the reboot, so it does not explain that
shutdown. Microsoft Store app updates were logged at 20:24–20:26; their timing
alone does not show causation.

The QEMU process found during this mission was `LifeOS-QA` on port 5554,
started at 20:43:53—after the 20:28:39 shutdown. It therefore did not cause
that recorded shutdown. It held about 3.35 GB working set / 3.46 GB private
memory and its log shows ADB offline. It exited during inspection; a subsequent
request to its emulator console found port 5554 already closed. Available RAM
then rose to 5.79 GB. The previous launcher missed the Windows process name
`qemu-system-x86_64-headless`, which explains why its cleanup could leave the
QEMU child behind.

## Reversible AVD and launcher changes

- Preserved the previous AVD config at
  `D:\LifeOS-Android-QA\backups\LifeOS-QA-config-before-Mission06-20261117.ini`.
- Changed only the LifeOS-QA AVD to force a cold boot and disable local or
  downloadable snapshot load/save. Its 2 GB RAM, two cores, host GPU, and
  720 × 1280 / 320 dpi display remain unchanged.
- Updated the AVD setup helper to retain those snapshot settings on new setup.
- Fixed the launcher to track the exact `LifeOS-QA` QEMU child, sample host
  free RAM and QEMU memory/CPU every five seconds, and gracefully shut down the
  AVD after a successful boot check or on failure. It retains the 3.5 GB
  pre-start RAM floor and 300-second boot limit, with a 2.25 GB runtime abort
  floor. It now refuses to start without verified AC power and does not
  overwrite prior boot logs.

## Boot result and next step

**BLOCKED; no boot attempt was made in Mission 06.** Free RAM (5.68 GB) was
above the 3.5 GB threshold, but AC was offline and the battery read about 0.1%.
The launcher was invoked to validate its guard; it refused before starting an
emulator. No tests, ADB device listing, or physical-device operations occurred.

For testing now, prefer the existing GitHub-hosted emulator workflow once the
branch can be published and triggered with approval. It still needs these
repository secrets: `LIFEOS_DEBUG_KEYSTORE_BASE64`,
`LIFEOS_DEBUG_KEYSTORE_PASSWORD`, `LIFEOS_DEBUG_KEY_ALIAS`, and
`LIFEOS_DEBUG_KEY_PASSWORD`. The specific route is:

1. Configure those four secrets in the repository without placing values in
   source control.
2. With approval to publish, push this branch and open a PR targeting `main`;
   the existing pull-request trigger will run the workflow. Its hosted Ubuntu
   jobs enable KVM, use the isolated Dev APK, and run the API 34 notification
   profile plus the configured API 29/34/35 emulator coverage.
3. Review the uploaded candidate-build, JUnit, sanitized log, and screenshot
   artifacts. Hosted Actions usage may consume repository minutes.

No secret was configured, and no branch was published, PR created, or job
triggered in this mission.

For later local use, connect the AC adapter and confirm Windows reports
`PowerOnline=True`; then run `npm.cmd run qa:avd:start`. The launcher will only
perform its bounded verification boot when power, WHPX, AVD identity, and the
existing RAM floor all pass.

Evidence: previous boot logs are `D:\LifeOS-Android-QA\emulator.stdout.log`
and `D:\LifeOS-Android-QA\emulator.stderr.log`; current AVD config is
`D:\LifeOS-Android-QA\avd\LifeOS-QA.avd\config.ini`. No new emulator log or
resource CSV was created because the AC guard blocked startup.
