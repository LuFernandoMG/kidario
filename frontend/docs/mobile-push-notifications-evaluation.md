# Mobile Push Notifications Evaluation

## Decision

Push notifications are not implemented yet in the WebView-first phase.

## Reason

The current product still lacks the native ownership required to make push reliable:

- auth state is still frontend-owned inside the WebView
- there is no native device-token registration flow yet
- there is no backend event pipeline defined for chat and agenda notifications
- deep-link routing is only starting in milestone 4

## Recommendation

Do not add `expo-notifications` runtime wiring until these prerequisites exist:

1. native permission flow
2. device token registration linked to the authenticated user
3. backend triggers for chat and agenda events
4. deep links for opening the correct mobile shell destination

## Next Product Step

When mobile usage is validated, implement push in this order:

1. register device token natively
2. store token against the user profile
3. emit notifications from backend for chat and agenda only
4. open the shell through deep links such as `/chat/:threadId` and `/agenda`
