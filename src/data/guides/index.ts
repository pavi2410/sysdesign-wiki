import type { FeatureGuide, GuideCategory } from './types';
export type { FeatureGuide, GuideCategory };
export { guideCategoryLabels, guideCategoryColors } from './types';

import { sse } from './sse';
import { websocketInfra } from './websocket-infra';
import { presenceOnlineStatus } from './presence-online-status';
import { pushNotifications } from './push-notifications';
import { customDomains } from './custom-domains';
import { multiTenant } from './multi-tenant';
import { featureFlags } from './feature-flags';
import { rbac } from './rbac';
import { fullTextSearch } from './full-text-search';
import { feedTimeline } from './feed-timeline';
import { recommendationEngine } from './recommendation-engine';
import { cachingStrategies } from './caching-strategies';
import { rateLimiting } from './rate-limiting';
import { jobQueues } from './job-queues';
import { webhooks } from './webhooks';
import { apiVersioning } from './api-versioning';
import { e2eEncryption } from './e2e-encryption';
import { oauth2SocialLogin } from './oauth2-social-login';
import { paymentProcessing } from './payment-processing';
import { auditLogging } from './audit-logging';
import { fileUploadPipeline } from './file-upload-pipeline';
import { videoTranscoding } from './video-transcoding';
import { cdnAssetDelivery } from './cdn-asset-delivery';
import { collaborativeEditing } from './collaborative-editing';
import { urlShortener } from './url-shortener';

export const guides: FeatureGuide[] = [
  sse,
  websocketInfra,
  presenceOnlineStatus,
  pushNotifications,
  customDomains,
  multiTenant,
  featureFlags,
  rbac,
  fullTextSearch,
  feedTimeline,
  recommendationEngine,
  cachingStrategies,
  rateLimiting,
  jobQueues,
  webhooks,
  apiVersioning,
  e2eEncryption,
  oauth2SocialLogin,
  paymentProcessing,
  auditLogging,
  fileUploadPipeline,
  videoTranscoding,
  cdnAssetDelivery,
  collaborativeEditing,
  urlShortener,
];

export function getGuideBySlug(slug: string): FeatureGuide | undefined {
  return guides.find((g) => g.slug === slug);
}

export function getGuidesByCategory(category: GuideCategory): FeatureGuide[] {
  return guides.filter((g) => g.category === category);
}

export function getAllGuideCategories(): GuideCategory[] {
  return [...new Set(guides.map((g) => g.category))];
}

export function getAllGuideTags(): string[] {
  return [...new Set(guides.flatMap((g) => g.tags))].sort();
}
