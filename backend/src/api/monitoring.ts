import { Router } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middlewares/auth';
import { performanceMonitor } from '../core/system-monitoring/PerformanceMonitor';

const router = Router();

router.get('/metrics', authenticate, requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const metrics = performanceMonitor.getAllMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

router.get('/metrics/:name', authenticate, requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.params;
    const stats = performanceMonitor.getStats(name);
    res.json({
      success: true,
      data: stats,
      metricName: name,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

router.post('/metrics/reset', authenticate, requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body;
    
    if (name) {
      performanceMonitor.resetMetric(name);
      res.json({
        success: true,
        message: `Metric "${name}" reset successfully`
      });
    } else {
      performanceMonitor.resetAll();
      res.json({
        success: true,
        message: 'All metrics reset successfully'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

router.get('/report', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const report = performanceMonitor.getPerformanceReport();
    performanceMonitor.logPerformanceReport();
    
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;