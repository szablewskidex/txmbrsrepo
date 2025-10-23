// Performance Monitoring & Analytics

export interface GenerationMetrics {
  startTime: number;
  endTime: number;
  attemptCount: number;
  qualityScore: number;
  tokenUsage: number;
  cacheHit: boolean;
  fastMode: boolean;
  key: string;
  prompt: string;
  success: boolean;
  errorType?: string;
}

class AnalyticsManager {
  private metrics: GenerationMetrics[] = [];
  private readonly MAX_STORED_METRICS = 100;

  logGeneration(metrics: GenerationMetrics) {
    this.metrics.push({
      ...metrics,
      endTime: Date.now(),
    });

    // Keep only last 100 metrics
    if (this.metrics.length > this.MAX_STORED_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_STORED_METRICS);
    }

    // Log to console for debugging
    const duration = metrics.endTime - metrics.startTime;
    console.log(`[ANALYTICS] Generation completed:`, {
      duration: `${Math.round(duration / 1000)}s`,
      attempts: metrics.attemptCount,
      quality: metrics.qualityScore,
      tokens: metrics.tokenUsage,
      cached: metrics.cacheHit,
      fast: metrics.fastMode,
      success: metrics.success,
    });

    // Store in localStorage for persistence (only on client side)
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('pianoroll-analytics', JSON.stringify(this.metrics.slice(-10)));
      }
    } catch (e) {
      console.warn('[ANALYTICS] Failed to store metrics:', e);
    }
  }

  getStats() {
    const recent = this.metrics.slice(-20); // Last 20 generations
    
    if (recent.length === 0) {
      return null;
    }

    const successful = recent.filter(m => m.success);
    const avgDuration = successful.reduce((sum, m) => sum + (m.endTime - m.startTime), 0) / successful.length;
    const avgQuality = successful.reduce((sum, m) => sum + m.qualityScore, 0) / successful.length;
    const cacheHitRate = recent.filter(m => m.cacheHit).length / recent.length;
    const fastModeUsage = recent.filter(m => m.fastMode).length / recent.length;

    return {
      totalGenerations: recent.length,
      successRate: (successful.length / recent.length) * 100,
      avgDuration: Math.round(avgDuration / 1000), // seconds
      avgQuality: Math.round(avgQuality),
      cacheHitRate: Math.round(cacheHitRate * 100), // percentage
      fastModeUsage: Math.round(fastModeUsage * 100), // percentage
    };
  }

  exportMetrics() {
    return {
      metrics: this.metrics,
      stats: this.getStats(),
      exportedAt: new Date().toISOString(),
    };
  }
}

export const analytics = new AnalyticsManager();

// Helper function for easy logging
export function logGenerationMetrics(
  startTime: number,
  attemptCount: number,
  qualityScore: number,
  tokenUsage: number,
  cacheHit: boolean,
  fastMode: boolean,
  key: string,
  prompt: string,
  success: boolean,
  errorType?: string
) {
  analytics.logGeneration({
    startTime,
    endTime: Date.now(),
    attemptCount,
    qualityScore,
    tokenUsage,
    cacheHit,
    fastMode,
    key: key.substring(0, 20), // Truncate for privacy
    prompt: prompt.substring(0, 50), // Truncate for privacy
    success,
    errorType,
  });
}