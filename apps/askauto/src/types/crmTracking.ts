export interface CrmTrackingVisit {
    uuid: string;
    sessionId: string;
    url: string;
    visitedAt?: string;
}

export interface CrmTrackingResponse {
    clientUuid: string;
    trackingSessionId: string | null;
    visits: Array<{
        url: string;
        timestamp: string;
    }>;
    range?: {
        from: string;
        to: string;
    };
}

export interface CrmTrackingSession {
    id: string;
    uuid: string;
    createdAt: Date;
    lastSeenAt: Date;
}
