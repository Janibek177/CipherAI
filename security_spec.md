# Security Specification

## 1. Data Invariants
- Each user owns their root user document at `/users/{userId}`.
- All chat sessions and chat messages are nested subcollections under `/users/{userId}`.
- Only the authenticated owner matching `request.auth.uid == userId` can read, create, update, or delete chats and messages.
- No cross-user reads or modifications are ever permitted.
- Document IDs must conform to the alphanumeric and hyphen regex `^[a-zA-Z0-9_\-]+$` and be within 128 characters.

## 2. The Dirty Dozen Payloads (Rejection Scenarios)
1. Unauthenticated user trying to read `/users/{userId}/chats`. (DENIED: Missing auth)
2. Authenticated User A attempting to read `/users/{UserB}/chats`. (DENIED: UID mismatch)
3. Authenticated User A attempting to write `/users/{UserB}/chats/{chatId}`. (DENIED: UID mismatch)
4. Authenticated User A trying to inject a 2KB junk character string as chatId. (DENIED: isValidId fails)
5. Authenticated User A trying to read someone else's messages at `/users/{UserB}/chats/{chatId}/messages`. (DENIED: UID mismatch)
6. Client attempting to set `userId` in chat document to a different UID. (DENIED: userId check fails)
7. Client trying to read system documents or arbitrary collections via `/admin` or `/{document=**}`. (DENIED: Default deny)
8. Message creation with mismatched `userId` attribute. (DENIED: request.resource.data.userId == userId fails)
9. Client attempting to delete another user's chat or messages. (DENIED: UID mismatch)
10. Unauthenticated create request to user profile document. (DENIED: Missing auth)
11. Query attempting to list all chats across users. (DENIED: No collectionGroup allowance)
12. Attempting to update a message under another user's account. (DENIED: UID mismatch)
