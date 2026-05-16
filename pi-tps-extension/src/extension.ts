/**
 * TPS (Tokens Per Second) Metrics Extension for Pi
 * 
 * Tracks and displays real-time token generation speed during streaming.
 * Shows metrics in the footer: "🚀 45.2 t/s"
 */

import type { ExtensionContext, ExtensionDefinition } from "@earendil-works/pi-coding-agent";

interface StreamingMetrics {
  startTime: number;
  lastUpdateTime: number;
  tokenCount: number;
  lastTokenCount: number;
  tps: number;
  peakTps: number;
  totalTokens: number;
  isStreaming: boolean;
}

export default {
  name: "tps-metrics",
  version: "1.0.0",
  description: "Display real-time TPS (tokens per second) metrics during streaming",
  
  handlers: {
    message_start: async (event: any, ctx: ExtensionContext) => {
      if (event.message.role !== 'assistant') return;
      
      // Reset metrics for new message
      const metrics: StreamingMetrics = {
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        tokenCount: 0,
        lastTokenCount: 0,
        tps: 0,
        peakTps: 0,
        totalTokens: 0,
        isStreaming: true,
      };
      
      // Store metrics in context for this session
      (ctx as any)._tpsMetrics = metrics;
      
      // Show initial status
      ctx.ui.setStatus('tps', '🚀 Starting...');
    },
    
    message_update: async (event: any, ctx: ExtensionContext) => {
      if (event.message.role !== 'assistant') return;
      
      const metrics = (ctx as any)._tpsMetrics as StreamingMetrics | undefined;
      if (!metrics || !metrics.isStreaming) return;
      
      // Get current token count from usage
      const usage = event.message.usage;
      if (!usage) return;
      
      const currentTokens = usage.output || 0;
      const now = Date.now();
      const elapsed = (now - metrics.startTime) / 1000; // seconds
      
      // Calculate TPS
      if (elapsed > 0) {
        metrics.tps = Math.round((currentTokens / elapsed) * 10) / 10;
        metrics.peakTps = Math.max(metrics.peakTps, metrics.tps);
      }
      
      // Update token count
      metrics.tokenCount = currentTokens;
      metrics.totalTokens += (currentTokens - metrics.lastTokenCount);
      metrics.lastTokenCount = currentTokens;
      metrics.lastUpdateTime = now;
      
      // Format and display TPS
      const tpsStr = metrics.tps > 0 
        ? `🚀 ${metrics.tps} t/s` 
        : '🚀 Starting...';
      
      ctx.ui.setStatus('tps', tpsStr);
    },
    
    message_end: async (event: any, ctx: ExtensionContext) => {
      if (event.message.role !== 'assistant') return;
      
      const metrics = (ctx as any)._tpsMetrics as StreamingMetrics | undefined;
      if (!metrics) return;
      
      // Mark as no longer streaming
      metrics.isStreaming = false;
      
      // Get final token count
      const usage = event.message.usage;
      const totalTokens = usage?.output || metrics.totalTokens;
      const elapsed = (Date.now() - metrics.startTime) / 1000;
      
      // Calculate final metrics
      const finalTps = elapsed > 0 ? Math.round((totalTokens / elapsed) * 10) / 10 : 0;
      const avgTps = metrics.peakTps > 0 ? Math.round((metrics.peakTps * 0.7) * 10) / 10 : 0;
      
      // Display summary
      if (finalTps > 0) {
        const summary = `✅ ${totalTokens} tokens in ${elapsed.toFixed(1)}s (${finalTps} t/s avg)`;
        ctx.ui.setStatus('tps', summary);
      } else {
        ctx.ui.setStatus('tps', undefined); // Clear status
      }
      
      // Clear metrics after a delay
      setTimeout(() => {
        ctx.ui.setStatus('tps', undefined);
      }, 5000);
    },
    
    compaction_start: async (_event: any, ctx: ExtensionContext) => {
      // Clear TPS status during compaction
      ctx.ui.setStatus('tps', undefined);
    },
  },
} satisfies ExtensionDefinition;
