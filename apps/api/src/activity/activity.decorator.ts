import { SetMetadata } from '@nestjs/common';
import type { ActivityCategory } from './activity.types';

export const ACTIVITY_ACTION_KEY = 'the-bridge:activity-action';
export const SKIP_ACTIVITY_KEY = 'the-bridge:skip-activity';

export interface ActivityActionMetadata {
  category: ActivityCategory;
  action: string;
  subjectType?: string;
  subjectParam?: string;
}

export function ActivityAction(metadata: ActivityActionMetadata) {
  return SetMetadata(ACTIVITY_ACTION_KEY, metadata);
}

export function SkipActivity() {
  return SetMetadata(SKIP_ACTIVITY_KEY, true);
}
