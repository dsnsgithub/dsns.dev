import type { components } from "@octokit/openapi-types";
import type {
	CommitCommentEvent,
	CreateEvent,
	DeleteEvent,
	DiscussionEvent,
	ForkEvent,
	GollumEvent,
	IssueCommentEvent,
	IssuesEvent,
	MemberEvent,
	PublicEvent,
	PullRequestEvent,
	PullRequestReviewCommentEvent,
	PullRequestReviewEvent,
	PushEvent,
	ReleaseEvent,
	WatchEvent
} from "@octokit/webhooks-types";

interface EventPayloadMap {
	CreateEvent: CreateEvent;
	DeleteEvent: DeleteEvent;
	DiscussionEvent: DiscussionEvent;
	IssuesEvent: IssuesEvent;
	IssueCommentEvent: IssueCommentEvent;
	ForkEvent: ForkEvent;
	GollumEvent: GollumEvent;
	MemberEvent: MemberEvent;
	PublicEvent: PublicEvent;
	PushEvent: PushEvent;
	PullRequestEvent: PullRequestEvent;
	PullRequestReviewCommentEvent: PullRequestReviewCommentEvent;
	PullRequestReviewEvent: PullRequestReviewEvent;
	CommitCommentEvent: CommitCommentEvent;
	ReleaseEvent: ReleaseEvent;
	WatchEvent: WatchEvent;
}

export function isEvent<T extends keyof EventPayloadMap>(event: components["schemas"]["event"], type: T): event is components["schemas"]["event"] & { type: T; payload: EventPayloadMap[T] } {
	return event.type === type;
}
