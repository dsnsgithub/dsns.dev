import type { components } from "@octokit/openapi-types";

interface EventPayloadMap {
	CreateEvent: components["schemas"]["create-event"];
	DeleteEvent: components["schemas"]["delete-event"];
	DiscussionEvent: components["schemas"]["discussion-event"];
	IssuesEvent: components["schemas"]["issues-event"];
	IssueCommentEvent: components["schemas"]["issue-comment-event"];
	ForkEvent: components["schemas"]["fork-event"];
	GollumEvent: components["schemas"]["gollum-event"];
	MemberEvent: components["schemas"]["member-event"];
	PublicEvent: components["schemas"]["public-event"];
	PushEvent: components["schemas"]["push-event"];
	PullRequestEvent: components["schemas"]["pull-request-event"];
	PullRequestReviewCommentEvent: components["schemas"]["pull-request-review-comment-event"];
	PullRequestReviewEvent: components["schemas"]["pull-request-review-event"];
	CommitCommentEvent: components["schemas"]["commit-comment-event"];
	ReleaseEvent: components["schemas"]["release-event"];
	WatchEvent: components["schemas"]["watch-event"];
};

export function isEvent<T extends keyof EventPayloadMap>(event: components["schemas"]["event"], type: T): event is components["schemas"]["event"] & { type: T; payload: EventPayloadMap[T] } {
	return event.type === type;
}
