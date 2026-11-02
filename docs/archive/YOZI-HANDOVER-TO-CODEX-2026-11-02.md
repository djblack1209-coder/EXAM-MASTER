# Yozi handover: Claude -> Codex (2026-11-02)

Reason: Claude (Code session "Yozi perfect") hit the weekly limit: Usage shows Weekly - all models 100%, resets Thu Nov 5, 9:00 PM (Beijing). Per the user's standing rule (2026-11-01 23:20), the Claude client is being quit and Yozi's unfinished work moves to Codex until the reset. Do NOT enable usage credits.

## Exact state where Claude stopped (read from the session tail, 2026-11-02 ~00:40)

The current batch was nearly done:
- Final Agnes run on the finished rules (three rounds): 5 of 6 checks passed; the one rejection (an empty list) was the correct result.
- Test app was closed and unregistered; the test backend (recorded PID 29613) was stopped before its files were replaced.
- The updated backend was compiled into a fresh folder and swapped in. The first Ideas backend was moved to the Trash and replaced by the new build; the 10-26 backend copies were kept (nothing showed they are redundant).
- While the app build ran: lint and the affected test files were run - 15 test files, 362 tests pass. Docs were updated and the diff check is clean.
- A commit message was drafted in commit-msg.txt and Claude was checking exactly which files go into the commit.
- The app build then reported exit 1. Last time this was the harmless Launch Services step at the very end, but that must be verified from the log and the signature, not assumed.

## Immediate next steps for Codex (in order)

1. Check the app build log and the built app's signature. If exit 1 was only the harmless Launch Services step and the signature verifies, make this build the test candidate and log its hash, exactly as Claude planned.
2. If the build or signature is actually bad, rebuild and diagnose; do not commit a broken candidate.
3. Finish the commit using the drafted commit-msg.txt, with exactly the file set Claude was verifying (docs already updated, diff clean). Report the commit hash.
4. Write the outcome to YOZI-HANDOVER-RESULT.md in this folder.
5. Then continue with the remaining Yozi work from docs/13-DEVELOPMENT-PLAN.md section 0 (the G-line replay items converging on G17 and the one practical acceptance run to Y-G2), following the plan file, not this note, for scope.

## Standing notes

- Known unrelated blocker, do not chase it: the on-screen sign-in test remains blocked because the test email's underscore cannot be typed in the background. It was already noted by Claude.
- Screenshot discipline (carried over from the earlier Yozi correction): maintain ONE shared screenshot set for Yozi/Lazy verification; reuse existing screenshots and the Muse2 detail reference; only re-shoot single missing pages; never re-shoot a whole set.
- Follow the existing anti-over-engineering rules: verify by running the real main flow; verify only the increment against the verified list; no speculative defenses without explaining the failure mode first.
- Model/channel rules unchanged: free channels first, DeepSeek API as paid fallback only on 429/quality failure; no amount cap, keep technical anti-loop limits.
