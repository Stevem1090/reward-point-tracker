export type UserProfile = {
  id: string;
  name: string | null;
  color: string | null;
  created_at: string;
};

export type UserPushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

// Response type for subscription operations
export interface SubscriptionResponse {
  success: boolean;
  message: string;
}
