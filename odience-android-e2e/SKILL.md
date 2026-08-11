---
name: odience-android-e2e
description: Connects to the Summit Android test device, safely identifies Odience versus native Prodience packages, launches only an explicitly verified target, and supports Android end-to-end testing. Use when testing Odience or Prodience on an Android emulator or physical device, using ADB, or validating mobile flows from Director.
---

# Odience Android E2E

## Temporary emulator notice

The `Pixel_API_35` AVD currently crashes during QEMU/WHPX boot and becomes ADB
`offline`. Immediately notify the user that the emulator path is broken and should
be fixed. Until this notice is removed, default to wireless ADB. Do not spend time
retrying the emulator unless the user explicitly asks to diagnose it.

## Safety rules

- Never choose an app by display name, substring, or the word `odience` alone.
- Never substitute a Prodience/native package when Odience was requested.
- Before every launch, verify the exact package and resolved launcher activity.
- Refuse to launch if the package is absent, the launcher differs, or identity is
  ambiguous. Show the discovered metadata and ask the user to identify it.
- Never install, uninstall, clear data, or force-stop another package implicitly.
- If the user explicitly asks to remove a conflicting target, inventory first and
  operate only on the exact confirmed package.

## Known identities

| Product | Implementation | Package | Launcher | Status |
| --- | --- | --- | --- | --- |
| Odience | Unity | `com.summit.odience.client` | `com.summit.odience.common.OdienceActivity` | Confirmed on RMX2202; do not confuse with native Prodience |
| Prodience (app-store messaging) | Native `RcsApp` | `com.summit.ims.app.messaging` | `com.summit.ims.app.activity.SplashActivity` | Separate messaging package; does not claim Director App Links |
| Prodience (Director-linked app) | Native `RcsApp` | `com.summit.ims.app.odience` | `com.summit.ims.app.activity.SplashActivity` | Installed/provisioned on RMX2202; package named by Director's assetlinks.json |

The native project also defines `.calling` and `.contacts` packages. They are not
Odience targets.

## Determine the active Director

Do not infer the API environment from Android App Links. App Links only select
the package for a URL; native Prodience obtains its Director API base URL from
ACS key `vr.directorAddress` (full provisioning path
`APPLICATION/OTHER/summit-tech/vr.directorAddress`). An app that claims the test
domain can still call production.

Prefer read-only connection inspection when ACS storage is inaccessible. Get the
app PID and UID, inspect `/proc/PID/net/tcp*`, retain sockets owned by that UID,
decode the little-endian remote IPv4 address, and compare it with DNS for the
candidate Director hosts. Verify again while refreshing the event list. Do not
automate secret dialer codes: vendor dialers can rearrange controls or intercept
the code unpredictably.

Known distinction:

- `director.odience.com` is production.
- `director.test.getrcs.com` is staging.

If the app calls production while the test data and commits are on staging, stop
claiming a phone E2E result. Ask for a staging ACS profile or a correctly signed,
staging-provisioned build.

## Connect

The reserved device IP is `192.168.0.17`. Wireless-debugging ports can change.

```bash
scripts/odience-adb connect 192.168.0.17:PORT
scripts/odience-adb status
```

If the saved endpoint fails, run `adb mdns services` and select the `_adb-tls-connect`
entry for `192.168.0.17`. Do not confuse its port with the `_adb-tls-pairing` port.
If the device is not already paired, ask the user for the pairing endpoint and
six-digit code, then use `adb pair IP:PAIRING_PORT`.

## Launch and test

Run inventory before a first launch or after an app reinstall:

```bash
scripts/odience-adb inventory
scripts/odience-adb launch-odience
```

`launch-odience` is intentionally blocked until `ODIENCE_CONFIRMED=1` is supplied.
Only set it after the user confirms the candidate identity:

```bash
ODIENCE_CONFIRMED=1 scripts/odience-adb launch-odience
```

For native Prodience, verify and launch only the exact package requested. Do not
assume the app-store `com.summit.ims.app.messaging` package is the
Director-linked flavor; check `pm get-app-links` first:

```bash
adb -s SERIAL shell cmd package resolve-activity --brief \
  -a android.intent.action.MAIN -c android.intent.category.LAUNCHER \
  -p com.summit.ims.app.odience
adb -s SERIAL shell am start -n \
  com.summit.ims.app.odience/com.summit.ims.app.activity.SplashActivity
```

The Director test domain must appear in `pm get-app-links` for the selected
package. If it does not, `/i/{id}` will resolve to Chrome regardless of the
server's `assetlinks.json`. The package and signing certificate must match the
corresponding asset-links entry.

When testing an Android App Link, test both cold and warm launches without
clearing app data:

```bash
adb -s SERIAL shell am force-stop com.summit.ims.app.odience
adb -s SERIAL shell am start -W -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE -d 'https://director.test.getrcs.com/i/INVITE_ID'
adb -s SERIAL shell am start -W -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE -d 'https://director.test.getrcs.com/i/INVITE_ID'
```

The native client is expected to resolve `/i/{id}` as an invitation ID, then use
the invitation's event ID. If it instead treats the number as an event ID, report
that as a native deep-link defect. Use logcat and UI state for evidence; avoid
mobile-web login when the native flow is the subject of the test.

## Director-to-native invitation E2E

Use the authenticated Director page already open in Chrome when possible. Per
the workspace MCP policy, discover and call it through MCPorter:

```bash
bunx mcporter list
bunx mcporter call chrome-devtools.list_pages
bunx mcporter call chrome-devtools.select_page pageId=PAGE_ID bringToFront=true
bunx mcporter call chrome-devtools.take_snapshot verbose=false
```

Navigate to `/group/GROUP_ID/event/invitation/EVENT_ID/index`, then use
snapshot UIDs rather than coordinates to add an individual email invitation.
Record the invited count and exact recipient before acting. After Director
reports success, refresh the phone's **Invited** tab and assert that the named
event appears. Uninvite only the matching recipient row, verify Director's count
returns to its original value, refresh the phone again, and assert the event is
absent.

For the RMX2202's 1080x2400 layout, this pull gesture reliably invokes the
native list refresh when the list is at its top:

```bash
adb -s SERIAL logcat -c
adb -s SERIAL shell input touchscreen swipe 540 300 540 1900 2000
sleep 15
adb -s SERIAL shell uiautomator dump /sdcard/invited.xml
adb -s SERIAL shell cat /sdcard/invited.xml
```

A shorter drag can move visually without invoking the refresh handler. Confirm
a real refresh by checking logcat for a new request to the expected Director.
For a public event, uninviting does not necessarily remove the event from the
API response; the decisive contract is that its `invitationAccepted` value
changes from `true` to `false` and it disappears from the **Invited** filter.

If Prodience was newly provisioned, first refresh and confirm logcat shows
`director.test.getrcs.com:8442`. The current staging setup was made by selecting
the staging Director in the device's IMS settings and then resetting/reprovisioning
Prodience. Treat this as environment setup, not an App Links setting.

For E2E work, clear logcat only when useful, perform the requested flow, capture
relevant logcat/screenshots, and report the device serial, exact package, version,
steps, and observed result. Do not change accounts or test data beyond the flow
authorized by the user.

When a staging-provisioned client is unavailable, validate the server contract as
a clearly labelled workaround: authenticate the staging user, call the deployed
events controller, execute the deployed invite/uninvite repository path, and call
the events controller again. Assert that `invitation_accepted` changes as expected
and that the notification jobs complete without new failures. Account for every
identity: a separate MSISDN invite keeps the event invited after an email invite
is removed. This validates the backend contract but does not replace a phone E2E.
