import {
  FeedbackData,
  ModelVersion,
  TrainingJob,
  IterationCycle,
  PipelineStep,
  ImprovementSuggestion,
  IterationPlan,
  IterationTask,
  Milestone,
  AutomatedTest,
  TestCase,
  TestReport,
  TestCaseResult,
  PerformanceMetrics,
  PerformanceRegression,
  CanaryRelease,
  CanaryMetrics,
  RollbackPolicy,
  TeamMember,
  TaskAssignment,
  TeamNotification,
  ApprovalRequest,
  ApprovalInfo,
  IterationAnalytics,
  PerformanceTrend,
  TeamVelocity,
  ABTestConfig
} from './types';
import { FeedbackCollector } from './FeedbackCollector';
import { ModelVersionManager } from './ModelVersionManager';

export class ContinuousIterationSystem {
  private feedbackCollector: FeedbackCollector;
  private versionManager: ModelVersionManager;
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private iterationCycles: Map<string, IterationCycle> = new Map();
  private currentCycle: IterationCycle | null = null;
  private pipelineSteps: Map<string, PipelineStep> = new Map();
  private improvementSuggestions: Map<string, ImprovementSuggestion> = new Map();

  // ==================== 增强功能属性 ====================
  // 迭代计划管理
  private iterationPlans: Map<string, IterationPlan> = new Map();
  private currentPlan: IterationPlan | null = null;

  // 自动化测试
  private automatedTests: Map<string, AutomatedTest> = new Map();
  private testReports: TestReport[] = [];
  private performanceBaselines: Map<string, PerformanceMetrics> = new Map();

  // 性能回归检测
  private performanceRegressions: Map<string, PerformanceRegression> = new Map();
  private currentPerformanceMetrics: PerformanceMetrics | null = null;

  // A/B测试
  private abTests: Map<string, ABTestConfig> = new Map();
  private activeABTest: ABTestConfig | null = null;

  // 灰度发布
  private canaryReleases: Map<string, CanaryRelease> = new Map();
  private activeCanary: CanaryRelease | null = null;

  // 回滚历史
  private rollbackHistory: Map<string, { versionId: string; reason: string; timestamp: Date; automatic: boolean }> = new Map();

  // 团队协作
  private teamMembers: Map<string, TeamMember> = new Map();
  private taskAssignments: Map<string, TaskAssignment> = new Map();
  private notifications: TeamNotification[] = [];

  // 发布审批
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private pendingApprovals: ApprovalRequest[] = [];

  constructor() {
    this.feedbackCollector = new FeedbackCollector();
    this.versionManager = new ModelVersionManager();
  }

  addFeedback(feedback: FeedbackData): void {
    this.feedbackCollector.addFeedback(feedback);

    if (this.currentCycle) {
      this.currentCycle.feedbackCount++;
    }
  }

  getFeedback(options?: Parameters<FeedbackCollector['getFeedbacks']>[0]): FeedbackData[] {
    return this.feedbackCollector.getFeedbacks(options);
  }

  getFeedbackTrends(days: number = 30) {
    return this.feedbackCollector.analyzeFeedbackTrends(days);
  }

  startIterationCycle(goal?: string): IterationCycle {
    const cycle: IterationCycle = {
      id: `cycle_${Date.now()}`,
      startDate: new Date(),
      feedbackCount: 0,
      trainingJobs: [],
      modelVersions: [],
      status: 'collecting',
      goal,
      lessonsLearned: [],
      improvements: {}
    };

    this.iterationCycles.set(cycle.id, cycle);
    this.currentCycle = cycle;
    return cycle;
  }

  createTrainingJob(
    type: TrainingJob['type'],
    datasetId: string,
    config: Record<string, unknown>,
    options?: {
      priority?: TrainingJob['priority'];
      resources?: TrainingJob['resources'];
    }
  ): TrainingJob {
    const job: TrainingJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      datasetId,
      status: 'pending',
      progress: 0,
      config,
      priority: options?.priority || 'medium',
      resources: options?.resources
    };

    this.trainingJobs.set(job.id, job);

    if (this.currentCycle) {
      this.currentCycle.trainingJobs.push(job.id);
    }

    return job;
  }

  startTrainingJob(jobId: string): boolean {
    const job = this.trainingJobs.get(jobId);
    if (!job) return false;

    job.status = 'running';
    job.startTime = new Date();

    this.simulateTrainingProgress(jobId);
    return true;
  }

  cancelTrainingJob(jobId: string): boolean {
    const job = this.trainingJobs.get(jobId);
    if (!job || job.status === 'completed') return false;

    job.status = 'cancelled';
    job.endTime = new Date();
    return true;
  }

  private simulateTrainingProgress(jobId: string): void {
    const job = this.trainingJobs.get(jobId);
    if (!job) return;

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;

      if (progress >= 100) {
        progress = 100;
        job.status = 'completed';
        job.endTime = new Date();
        job.progress = progress;
        clearInterval(interval);

        const newVersion = this.versionManager.createVersion(
          `v${Date.now()}`,
          `${job.type}_model`,
          {
            createdBy: 'system',
            metrics: { 
              accuracy: 0.85 + Math.random() * 0.1,
              f1_score: 0.78 + Math.random() * 0.12,
              user_satisfaction: 0.82 + Math.random() * 0.08
            },
            tags: ['automated', 'ci'],
            deploymentEnv: 'staging'
          }
        );

        if (this.currentCycle) {
          this.currentCycle.modelVersions.push(newVersion.id);
        }
      } else {
        job.progress = progress;
      }
    }, 1000);
  }

  getTrainingJob(jobId: string): TrainingJob | undefined {
    return this.trainingJobs.get(jobId);
  }

  getTrainingJobs(filters?: {
    status?: TrainingJob['status'];
    type?: TrainingJob['type'];
    priority?: TrainingJob['priority'];
  }): TrainingJob[] {
    let jobs = Array.from(this.trainingJobs.values());

    if (filters?.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }

    if (filters?.type) {
      jobs = jobs.filter(j => j.type === filters.type);
    }

    if (filters?.priority) {
      jobs = jobs.filter(j => j.priority === filters.priority);
    }

    return jobs.sort(
      (a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0)
    );
  }

  deployModel(versionId: string, env?: ModelVersion['deploymentEnv']): boolean {
    if (env) {
      this.versionManager.updateVersion(versionId, { deploymentEnv: env });
    }
    return this.versionManager.setActiveVersion(versionId);
  }

  rollbackToVersion(versionId: string): boolean {
    const result = this.versionManager.rollbackToVersion(versionId);
    
    if (result && this.currentCycle) {
      this.currentCycle.status = 'rolled_back';
    }

    return result;
  }

  getActiveModel(): ModelVersion | null {
    return this.versionManager.getActiveVersion();
  }

  getModelVersions(filters?: Parameters<ModelVersionManager['getVersions']>[0]): ModelVersion[] {
    return this.versionManager.getVersions(filters);
  }

  compareVersions(versionAId: string, versionBId: string) {
    return this.versionManager.compareVersions(versionAId, versionBId);
  }

  getBestPerformingModel() {
    return this.versionManager.getBestPerformingVersion();
  }

  getCurrentCycle(): IterationCycle | null {
    return this.currentCycle;
  }

  getIterationCycles(): IterationCycle[] {
    return Array.from(this.iterationCycles.values()).sort(
      (a, b) => b.startDate.getTime() - a.startDate.getTime()
    );
  }

  completeCycle(lessonsLearned?: string[]): IterationCycle | null {
    if (!this.currentCycle) return null;

    this.currentCycle.status = 'completed';
    this.currentCycle.endDate = new Date();
    
    if (lessonsLearned) {
      this.currentCycle.lessonsLearned = lessonsLearned;
    }

    this.currentCycle.improvements = this.calculateImprovements();

    const completedCycle = this.currentCycle;
    this.currentCycle = null;
    return completedCycle;
  }

  private calculateImprovements(): Record<string, number> {
    const improvements: Record<string, number> = {};
    
    const versions = this.getModelVersions();
    if (versions.length >= 2) {
      const newVersion = versions[0];
      const oldVersion = versions[1];
      
      if (newVersion.metrics && oldVersion.metrics) {
        for (const [metric, value] of Object.entries(newVersion.metrics)) {
          if (oldVersion.metrics[metric] !== undefined) {
            const diff = value - oldVersion.metrics[metric];
            improvements[metric] = diff;
          }
        }
      }
    }

    return improvements;
  }

  getImprovementSuggestions(): ImprovementSuggestion[] {
    const fromFeedback = this.feedbackCollector.generateImprovementSuggestions();
    
    const fromComparison: ImprovementSuggestion[] = [];
    const versions = this.getModelVersions();
    
    if (versions.length >= 2) {
      const comparison = this.compareVersions(versions[0].id, versions[1].id);
      if (comparison) {
        for (const [metric, data] of Object.entries(comparison.comparisonMetrics)) {
          if (data.diff < -0.05) {
            fromComparison.push({
              id: `suggestion_${Date.now()}_${metric}`,
              type: 'training_data',
              description: `${metric} has declined by ${(-data.diff * 100).toFixed(1)}% - consider retraining`,
              priority: 'medium',
              expectedImpact: 0.6,
              implementationCost: 0.4,
              status: 'suggested'
            });
          }
        }
      }
    }

    const allSuggestions = [...fromFeedback, ...fromComparison];
    
    for (const s of allSuggestions) {
      this.improvementSuggestions.set(s.id, s);
    }

    return allSuggestions;
  }

  updateSuggestionStatus(suggestionId: string, status: ImprovementSuggestion['status']) {
    const suggestion = this.improvementSuggestions.get(suggestionId);
    if (suggestion) {
      suggestion.status = status;
    }
  }

  createPipelineStep(step: Omit<PipelineStep, 'id' | 'status'>): PipelineStep {
    const pipelineStep: PipelineStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...step,
      status: 'pending'
    };

    this.pipelineSteps.set(pipelineStep.id, pipelineStep);
    return pipelineStep;
  }

  executePipelineStep(stepId: string): boolean {
    const step = this.pipelineSteps.get(stepId);
    if (!step) return false;

    step.status = 'running';
    step.startTime = new Date();

    setTimeout(() => {
      step.status = 'completed';
      step.endTime = new Date();
      if (step.startTime) {
        step.duration = step.endTime.getTime() - step.startTime.getTime();
      }
    }, 1000);

    return true;
  }

  getFullReport() {
    return {
      feedback: this.feedbackCollector.getFeedbackStats(),
      training: {
        totalJobs: this.trainingJobs.size,
        completedJobs: this.getTrainingJobs({ status: 'completed' }).length,
        runningJobs: this.getTrainingJobs({ status: 'running' }).length,
        pendingJobs: this.getTrainingJobs({ status: 'pending' }).length
      },
      models: this.versionManager.getVersionStats(),
      iteration: {
        totalCycles: this.iterationCycles.size,
        currentCycle: this.getCurrentCycle()?.id,
        currentCycleStatus: this.getCurrentCycle()?.status
      },
      suggestions: {
        total: this.improvementSuggestions.size,
        pending: Array.from(this.improvementSuggestions.values()).filter(s => s.status === 'suggested').length
      }
    };
  }

  // ==================== 迭代计划管理 ====================

  createIterationPlan(name: string, description: string, startDate: Date, endDate: Date, createdBy: string, assignees: string[] = []): IterationPlan {
    const cycleId = this.currentCycle?.id || `cycle_${Date.now()}`;
    const plan: IterationPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      cycleId,
      startDate,
      endDate,
      status: 'draft',
      tasks: [],
      milestones: [],
      progress: 0,
      createdBy,
      assignees
    };

    this.iterationPlans.set(plan.id, plan);
    this.currentPlan = plan;
    return plan;
  }

  addTaskToPlan(planId: string, task: Omit<IterationTask, 'id'>): IterationTask {
    const plan = this.iterationPlans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const newTask: IterationTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...task
    };

    plan.tasks.push(newTask);
    this.updatePlanProgress(planId);
    return newTask;
  }

  updateTaskStatus(planId: string, taskId: string, status: IterationTask['status']): boolean {
    const plan = this.iterationPlans.get(planId);
    if (!plan) return false;

    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.status = status;
    if (status === 'completed' && !task.endDate) {
      task.endDate = new Date();
      if (task.startDate && task.estimatedHours) {
        const hoursSpent = (task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60);
        task.actualHours = hoursSpent;
      }
    }

    this.updatePlanProgress(planId);
    return true;
  }

  addMilestoneToPlan(planId: string, milestone: Omit<Milestone, 'id'>): Milestone {
    const plan = this.iterationPlans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const newMilestone: Milestone = {
      id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...milestone
    };

    plan.milestones.push(newMilestone);
    return newMilestone;
  }

  private updatePlanProgress(planId: string): void {
    const plan = this.iterationPlans.get(planId);
    if (!plan || plan.tasks.length === 0) return;

    const completedTasks = plan.tasks.filter(t => t.status === 'completed').length;
    plan.progress = Math.round((completedTasks / plan.tasks.length) * 100);
  }

  activatePlan(planId: string): boolean {
    const plan = this.iterationPlans.get(planId);
    if (!plan) return false;

    plan.status = 'active';
    this.currentPlan = plan;
    return true;
  }

  getIterationPlan(planId: string): IterationPlan | undefined {
    return this.iterationPlans.get(planId);
  }

  getIterationPlans(filters?: { status?: IterationPlan['status']; cycleId?: string }): IterationPlan[] {
    let plans = Array.from(this.iterationPlans.values());

    if (filters?.status) {
      plans = plans.filter(p => p.status === filters.status);
    }
    if (filters?.cycleId) {
      plans = plans.filter(p => p.cycleId === filters.cycleId);
    }

    return plans.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  getCurrentPlan(): IterationPlan | null {
    return this.currentPlan;
  }

  // ==================== 自动化测试集成 ====================

  registerAutomatedTest(test: Omit<AutomatedTest, 'id' | 'status'>): AutomatedTest {
    const newTest: AutomatedTest = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...test,
      status: 'pending'
    };

    this.automatedTests.set(newTest.id, newTest);
    return newTest;
  }

  runAutomatedTest(testId: string): TestReport {
    const test = this.automatedTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    test.status = 'running';
    test.lastRunTime = new Date();

    const results: TestCaseResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const startTime = Date.now();

    for (const tc of test.testCases) {
      const duration = Math.random() * 5000 + 100;
      const randomResult = Math.random();

      let status: 'passed' | 'failed' | 'skipped';
      if (randomResult < 0.85) {
        status = 'passed';
        passed++;
      } else if (randomResult < 0.95) {
        status = 'failed';
        failed++;
      } else {
        status = 'skipped';
        skipped++;
      }

      tc.status = status;
      tc.duration = duration;

      results.push({
        testId: tc.id,
        name: tc.name,
        status,
        duration,
        error: status === 'failed' ? 'Assertion failed: expected value did not match' : undefined
      });
    }

    test.lastResult = failed === 0 ? 'passed' : 'failed';
    test.status = failed === 0 ? 'passed' : 'failed';
    test.duration = Date.now() - startTime;

    const report: TestReport = {
      totalTests: test.testCases.length,
      passed,
      failed,
      skipped,
      passRate: passed / test.testCases.length,
      duration: test.duration,
      timestamp: new Date(),
      details: results
    };

    this.testReports.push(report);
    return report;
  }

  getAutomatedTest(testId: string): AutomatedTest | undefined {
    return this.automatedTests.get(testId);
  }

  getAutomatedTests(filters?: { type?: AutomatedTest['type']; status?: AutomatedTest['status'] }): AutomatedTest[] {
    let tests = Array.from(this.automatedTests.values());

    if (filters?.type) {
      tests = tests.filter(t => t.type === filters.type);
    }
    if (filters?.status) {
      tests = tests.filter(t => t.status === filters.status);
    }

    return tests;
  }

  getTestReports(limit: number = 10): TestReport[] {
    return this.testReports.slice(-limit).reverse();
  }

  getTestTrend(days: number = 30): { date: Date; passRate: number }[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.testReports
      .filter(r => r.timestamp.getTime() > cutoff)
      .map(r => ({ date: r.timestamp, passRate: r.passRate }));
  }

  // ==================== 性能回归检测 ====================

  setPerformanceBaseline(metrics: PerformanceMetrics, versionId?: string): void {
    const key = versionId || 'default';
    this.performanceBaselines.set(key, metrics);
  }

  recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.currentPerformanceMetrics = metrics;
    this.checkForRegressions(metrics);
  }

  private checkForRegressions(current: PerformanceMetrics): void {
    const baseline = this.performanceBaselines.get('default');
    if (!baseline) {
      this.performanceBaselines.set('default', current);
      return;
    }

    const checks: { metric: string; current: number; baseline: number; threshold: number }[] = [
      { metric: 'latency_avg', current: current.latency.avg, baseline: baseline.latency.avg, threshold: 0.1 },
      { metric: 'error_rate', current: current.errorRate, baseline: baseline.errorRate, threshold: 0.05 },
      { metric: 'throughput', current: current.throughput, baseline: baseline.throughput, threshold: -0.1 }
    ];

    for (const check of checks) {
      const diff = check.current - check.baseline;
      const percentChange = check.baseline !== 0 ? diff / check.baseline : 0;

      if (Math.abs(percentChange) > Math.abs(check.threshold)) {
        const regression: PerformanceRegression = {
          id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          detectedAt: new Date(),
          metric: check.metric,
          baselineValue: check.baseline,
          currentValue: check.current,
          threshold: check.threshold,
          severity: Math.abs(percentChange) > 0.3 ? 'critical' : Math.abs(percentChange) > 0.2 ? 'high' : 'medium',
          status: 'detected',
          affectedVersions: []
        };

        this.performanceRegressions.set(regression.id, regression);
      }
    }
  }

  getPerformanceRegressions(status?: PerformanceRegression['status']): PerformanceRegression[] {
    const regressions = Array.from(this.performanceRegressions.values());
    if (status) {
      return regressions.filter(r => r.status === status);
    }
    return regressions.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  resolveRegression(regressionId: string, isFalsePositive: boolean = false): boolean {
    const regression = this.performanceRegressions.get(regressionId);
    if (!regression) return false;

    regression.status = isFalsePositive ? 'false_positive' : 'resolved';
    return true;
  }

  getCurrentPerformanceMetrics(): PerformanceMetrics | null {
    return this.currentPerformanceMetrics;
  }

  // ==================== A/B测试支持 ====================

  createABTest(config: Omit<ABTestConfig, 'id' | 'status'>): ABTestConfig {
    const test: ABTestConfig = {
      id: `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...config,
      status: 'draft'
    };

    this.abTests.set(test.id, test);
    return test;
  }

  startABTest(testId: string): boolean {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'draft') return false;

    if (this.activeABTest) {
      this.activeABTest.status = 'paused';
    }

    test.status = 'running';
    this.activeABTest = test;
    return true;
  }

  getABTest(testId: string): ABTestConfig | undefined {
    return this.abTests.get(testId);
  }

  getABTests(status?: ABTestConfig['status']): ABTestConfig[] {
    const tests = Array.from(this.abTests.values());
    if (status) {
      return tests.filter(t => t.status === status);
    }
    return tests;
  }

  completeABTest(testId: string, winner: string): boolean {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') return false;

    test.status = 'completed';
    test.endDate = new Date();

    if (this.activeABTest?.id === testId) {
      this.activeABTest = null;
    }

    if (winner && test.variants.includes(winner)) {
      this.versionManager.setActiveVersion(winner);
    }

    return true;
  }

  getActiveABTest(): ABTestConfig | null {
    return this.activeABTest;
  }

  // ==================== 灰度发布管理 ====================

  createCanaryRelease(
    versionId: string,
    name: string,
    trafficPercentage: number,
    rollbackPolicy: RollbackPolicy
  ): CanaryRelease {
    const release: CanaryRelease = {
      id: `canary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      versionId,
      name,
      trafficPercentage,
      targetUsers: Math.floor(trafficPercentage * 1000),
      status: 'preparing',
      metrics: {
        requestCount: 0,
        errorRate: 0,
        latencyIncrease: 0,
        userFeedback: 0
      },
      rollbackPolicy
    };

    this.canaryReleases.set(release.id, release);
    this.activeCanary = release;
    return release;
  }

  startCanaryRelease(releaseId: string): boolean {
    const release = this.canaryReleases.get(releaseId);
    if (!release) return false;

    release.status = 'testing';
    release.startTime = new Date();

    this.simulateCanaryMetrics(releaseId);
    return true;
  }

  private simulateCanaryMetrics(releaseId: string): void {
    const release = this.canaryReleases.get(releaseId);
    if (!release) return;

    const interval = setInterval(() => {
      if (release.status !== 'testing' && release.status !== 'promoting') {
        clearInterval(interval);
        return;
      }

      release.metrics.requestCount += Math.floor(Math.random() * 1000);
      release.metrics.errorRate = Math.random() * 0.05;
      release.metrics.latencyIncrease = Math.random() * 0.1;
      release.metrics.userFeedback = 3 + Math.random() * 2;

      if (release.rollbackPolicy.autoRollback) {
        if (release.metrics.errorRate > release.rollbackPolicy.errorThreshold) {
          this.rollbackCanary(releaseId, 'Auto rollback: error rate exceeded threshold');
          clearInterval(interval);
        } else if (release.metrics.latencyIncrease > release.rollbackPolicy.latencyThreshold) {
          this.rollbackCanary(releaseId, 'Auto rollback: latency increased exceeded threshold');
          clearInterval(interval);
        }
      }
    }, 5000);
  }

  promoteCanaryRelease(releaseId: string, newTrafficPercentage: number): boolean {
    const release = this.canaryReleases.get(releaseId);
    if (!release || release.status !== 'testing') return false;

    release.status = 'promoting';
    release.trafficPercentage = newTrafficPercentage;
    release.targetUsers = Math.floor(newTrafficPercentage * 1000);

    if (newTrafficPercentage >= 100) {
      release.status = 'completed';
      release.endTime = new Date();
      this.deployModel(release.versionId, 'production');
      this.activeCanary = null;
    }

    return true;
  }

  rollbackCanary(releaseId: string, reason: string): boolean {
    const release = this.canaryReleases.get(releaseId);
    if (!release) return false;

    release.status = 'rolled_back';
    release.endTime = new Date();

    this.rollbackHistory.set(releaseId, {
      versionId: release.versionId,
      reason,
      timestamp: new Date(),
      automatic: release.rollbackPolicy.autoRollback
    });

    if (this.activeCanary?.id === releaseId) {
      this.activeCanary = null;
    }

    const previousVersion = this.getBestPerformingModel();
    if (previousVersion) {
      this.rollbackToVersion(previousVersion.id);
    }

    return true;
  }

  getCanaryRelease(releaseId: string): CanaryRelease | undefined {
    return this.canaryReleases.get(releaseId);
  }

  getCanaryReleases(status?: CanaryRelease['status']): CanaryRelease[] {
    const releases = Array.from(this.canaryReleases.values());
    if (status) {
      return releases.filter(r => r.status === status);
    }
    return releases;
  }

  getActiveCanaryRelease(): CanaryRelease | null {
    return this.activeCanary;
  }

  // ==================== 回滚机制增强 ====================

  getRollbackHistory(): { versionId: string; reason: string; timestamp: Date; automatic: boolean }[] {
    return Array.from(this.rollbackHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  manualRollback(versionId: string, reason: string): boolean {
    const result = this.rollbackToVersion(versionId);

    if (result) {
      this.rollbackHistory.set(`manual_${Date.now()}`, {
        versionId,
        reason,
        timestamp: new Date(),
        automatic: false
      });
    }

    return result;
  }

  // ==================== 迭代进度追踪 ====================

  getIterationProgress(): {
    cycleProgress: number;
    taskProgress: { total: number; completed: number; inProgress: number; blocked: number };
    milestoneProgress: { total: number; achieved: number };
    timeline: { startDate: Date | null; endDate: Date | null; daysRemaining: number | null };
  } {
    const cycle = this.currentCycle;
    const plan = this.currentPlan;

    const taskProgress = plan ? {
      total: plan.tasks.length,
      completed: plan.tasks.filter(t => t.status === 'completed').length,
      inProgress: plan.tasks.filter(t => t.status === 'in_progress').length,
      blocked: plan.tasks.filter(t => t.status === 'blocked').length
    } : { total: 0, completed: 0, inProgress: 0, blocked: 0 };

    const milestoneProgress = plan ? {
      total: plan.milestones.length,
      achieved: plan.milestones.filter(m => m.status === 'achieved').length
    } : { total: 0, achieved: 0 };

    let daysRemaining: number | null = null;
    if (plan && plan.endDate) {
      const now = new Date();
      daysRemaining = Math.ceil((plan.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      cycleProgress: cycle ? (cycle.status === 'completed' ? 100 : plan?.progress || 0) : 0,
      taskProgress,
      milestoneProgress,
      timeline: {
        startDate: plan?.startDate || cycle?.startDate || null,
        endDate: plan?.endDate || null,
        daysRemaining
      }
    };
  }

  // ==================== 团队协作支持 ====================

  addTeamMember(member: Omit<TeamMember, 'id' | 'tasks' | 'workload'>): TeamMember {
    const newMember: TeamMember = {
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...member,
      tasks: [],
      workload: 0
    };

    this.teamMembers.set(newMember.id, newMember);
    return newMember;
  }

  assignTask(taskId: string, assigneeId: string, assignedBy: string): TaskAssignment | null {
    const assignee = this.teamMembers.get(assigneeId);
    if (!assignee) return null;

    const assignment: TaskAssignment = {
      id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      assigneeId,
      assignedAt: new Date(),
      assignedBy,
      status: 'assigned'
    };

    this.taskAssignments.set(assignment.id, assignment);
    assignee.tasks.push(taskId);
    assignee.workload = assignee.tasks.length;

    this.sendNotification({
      id: `notif_${Date.now()}`,
      type: 'task_assigned',
      recipientId: assigneeId,
      message: `You have been assigned to task: ${taskId}`,
      timestamp: new Date(),
      read: false
    });

    return assignment;
  }

  updateAssignmentStatus(assignmentId: string, status: TaskAssignment['status']): boolean {
    const assignment = this.taskAssignments.get(assignmentId);
    if (!assignment) return false;

    assignment.status = status;

    if (status === 'completed') {
      const assignee = this.teamMembers.get(assignment.assigneeId);
      if (assignee) {
        assignee.workload = Math.max(0, assignee.workload - 1);
        assignee.tasks = assignee.tasks.filter(t => t !== assignment.taskId);
      }

      this.sendNotification({
        id: `notif_${Date.now()}`,
        type: 'task_completed',
        recipientId: assignment.assignedBy,
        message: `Task ${assignment.taskId} has been completed`,
        timestamp: new Date(),
        read: false
      });
    }

    return true;
  }

  getTeamMember(memberId: string): TeamMember | undefined {
    return this.teamMembers.get(memberId);
  }

  getTeamMembers(): TeamMember[] {
    return Array.from(this.teamMembers.values());
  }

  private sendNotification(notification: TeamNotification): void {
    this.notifications.push(notification);
  }

  getNotifications(recipientId: string, unreadOnly: boolean = false): TeamNotification[] {
    let notifications = this.notifications.filter(n => n.recipientId === recipientId);
    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }
    return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  markNotificationAsRead(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) return false;

    notification.read = true;
    return true;
  }

  // ==================== 发布审批流程 ====================

  createApprovalRequest(
    versionId: string,
    type: ApprovalRequest['type'],
    requester: string,
    approverIds: string[]
  ): ApprovalRequest {
    const request: ApprovalRequest = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      versionId,
      type,
      status: 'pending',
      requester,
      approvers: approverIds.map(id => ({
        approverId: id,
        approverName: this.teamMembers.get(id)?.name || 'Unknown',
        status: 'pending'
      })),
      createdAt: new Date()
    };

    this.approvalRequests.set(request.id, request);
    this.pendingApprovals.push(request);

    for (const approver of request.approvers) {
      this.sendNotification({
        id: `notif_${Date.now()}`,
        type: 'review_requested',
        recipientId: approver.approverId,
        message: `Your approval is requested for ${type}: ${versionId}`,
        timestamp: new Date(),
        read: false
      });
    }

    return request;
  }

  approveRequest(requestId: string, approverId: string, comment?: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request || request.status !== 'pending') return false;

    const approver = request.approvers.find(a => a.approverId === approverId);
    if (!approver) return false;

    approver.status = 'approved';
    approver.timestamp = new Date();
    approver.comment = comment;

    this.checkApprovalCompletion(requestId);

    this.sendNotification({
      id: `notif_${Date.now()}`,
      type: 'release_approved',
      recipientId: request.requester,
      message: `${approver.approverName} approved your ${request.type} request`,
      timestamp: new Date(),
      read: false
    });

    return true;
  }

  rejectRequest(requestId: string, approverId: string, comment?: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request || request.status !== 'pending') return false;

    const approver = request.approvers.find(a => a.approverId === approverId);
    if (!approver) return false;

    approver.status = 'rejected';
    approver.timestamp = new Date();
    approver.comment = comment;
    request.status = 'rejected';
    request.updatedAt = new Date();

    this.pendingApprovals = this.pendingApprovals.filter(r => r.id !== requestId);

    this.sendNotification({
      id: `notif_${Date.now()}`,
      type: 'review_requested',
      recipientId: request.requester,
      message: `${approver.approverName} rejected your ${request.type} request: ${comment || 'No comment'}`,
      timestamp: new Date(),
      read: false
    });

    return true;
  }

  private checkApprovalCompletion(requestId: string): void {
    const request = this.approvalRequests.get(requestId);
    if (!request) return;

    const allApproved = request.approvers.every(a => a.status === 'approved');
    const anyRejected = request.approvers.some(a => a.status === 'rejected');

    if (anyRejected) {
      request.status = 'rejected';
      request.updatedAt = new Date();
      this.pendingApprovals = this.pendingApprovals.filter(r => r.id !== requestId);
    } else if (allApproved) {
      request.status = 'approved';
      request.updatedAt = new Date();
      this.pendingApprovals = this.pendingApprovals.filter(r => r.id !== requestId);

      if (request.type === 'deployment' || request.type === 'release') {
        this.deployModel(request.versionId, 'production');
      }
    }
  }

  getApprovalRequest(requestId: string): ApprovalRequest | undefined {
    return this.approvalRequests.get(requestId);
  }

  getPendingApprovals(): ApprovalRequest[] {
    return this.pendingApprovals;
  }

  cancelApprovalRequest(requestId: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request || request.status !== 'pending') return false;

    request.status = 'cancelled';
    request.updatedAt = new Date();
    this.pendingApprovals = this.pendingApprovals.filter(r => r.id !== requestId);
    return true;
  }

  // ==================== 迭代历史分析 ====================

  getIterationAnalytics(): IterationAnalytics {
    const cycles = this.getIterationCycles();
    const completedCycles = cycles.filter(c => c.status === 'completed');

    let totalDuration = 0;
    let totalTasks = 0;
    let completedTasks = 0;

    for (const plan of this.iterationPlans.values()) {
      totalTasks += plan.tasks.length;
      completedTasks += plan.tasks.filter(t => t.status === 'completed').length;

      if (plan.endDate && plan.startDate) {
        totalDuration += plan.endDate.getTime() - plan.startDate.getTime();
      }
    }

    const avgDuration = completedCycles.length > 0 ? totalDuration / completedCycles.length : 0;
    const avgTasks = completedCycles.length > 0 ? totalTasks / completedCycles.length : 0;
    const taskCompletionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    const performanceTrends = this.analyzePerformanceTrends();
    const teamVelocity = this.calculateTeamVelocity();
    const commonBottlenecks = this.identifyCommonBottlenecks();
    const recommendations = this.generateRecommendations(performanceTrends, teamVelocity, commonBottlenecks);

    return {
      totalCycles: cycles.length,
      completedCycles: completedCycles.length,
      averageCycleDuration: avgDuration,
      averageTasksPerCycle: avgTasks,
      taskCompletionRate,
      commonBottlenecks,
      performanceTrends,
      teamVelocity,
      recommendations
    };
  }

  private analyzePerformanceTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    const metrics = ['accuracy', 'f1_score', 'user_satisfaction', 'latency', 'error_rate'];
    const versions = this.getModelVersions();

    for (const metric of metrics) {
      const dataPoints: { date: Date; value: number }[] = [];

      for (const version of versions.slice(0, 10)) {
        if (version.metrics && version.metrics[metric] !== undefined) {
          dataPoints.push({
            date: version.createdAt,
            value: version.metrics[metric]
          });
        }
      }

      if (dataPoints.length >= 2) {
        const firstValue = dataPoints[dataPoints.length - 1].value;
        const lastValue = dataPoints[0].value;
        const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

        let direction: 'improving' | 'declining' | 'stable';
        if (Math.abs(changePercent) < 2) {
          direction = 'stable';
        } else if (changePercent > 0) {
          direction = metric === 'error_rate' || metric === 'latency' ? 'declining' : 'improving';
        } else {
          direction = metric === 'error_rate' || metric === 'latency' ? 'improving' : 'declining';
        }

        trends.push({
          metric,
          direction,
          changePercent,
          dataPoints: dataPoints.reverse()
        });
      }
    }

    return trends;
  }

  private calculateTeamVelocity(): TeamVelocity {
    const members = this.getTeamMembers();
    const currentVelocity = members.reduce((sum, m) => sum + (m.workload > 0 ? 1 : 0), 0);

    const completedAssignments = Array.from(this.taskAssignments.values())
      .filter(a => a.status === 'completed');

    const now = Date.now();
    const thisWeek = completedAssignments.filter(a => a.assignedAt.getTime() > now - 7 * 24 * 60 * 60 * 1000);
    const lastWeek = completedAssignments.filter(a => {
      const time = a.assignedAt.getTime();
      return time > now - 14 * 24 * 60 * 60 * 1000 && time <= now - 7 * 24 * 60 * 60 * 1000;
    });

    const current = thisWeek.length;
    const previous = lastWeek.length;
    const changePercent = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

    return {
      current,
      previous,
      changePercent,
      trend: Math.abs(changePercent) < 10 ? 'stable' : changePercent > 0 ? 'increasing' : 'decreasing'
    };
  }

  private identifyCommonBottlenecks(): string[] {
    const bottlenecks: string[] = [];
    const blockedTasks = new Map<string, number>();

    for (const plan of this.iterationPlans.values()) {
      for (const task of plan.tasks) {
        if (task.status === 'blocked' && task.dependencies) {
          for (const dep of task.dependencies) {
            blockedTasks.set(dep, (blockedTasks.get(dep) || 0) + 1);
          }
        }
      }
    }

    const sortedBottlenecks = Array.from(blockedTasks.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([taskId]) => taskId);

    return sortedBottlenecks;
  }

  private generateRecommendations(
    trends: PerformanceTrend[],
    velocity: TeamVelocity,
    bottlenecks: string[]
  ): string[] {
    const recommendations: string[] = [];

    const decliningMetrics = trends.filter(t => t.direction === 'declining');
    if (decliningMetrics.length > 0) {
      recommendations.push(`Warning: ${decliningMetrics.length} metrics are showing declining performance. Consider investigating recent changes.`);
    }

    if (velocity.trend === 'decreasing') {
      recommendations.push('Team velocity has decreased. Review task assignments and identify potential blockers.');
    }

    if (bottlenecks.length > 0) {
      recommendations.push(`Critical path bottleneck detected at task(s): ${bottlenecks.join(', ')}. Prioritize resolving these dependencies.`);
    }

    const testReports = this.getTestReports(5);
    if (testReports.length > 0) {
      const avgPassRate = testReports.reduce((sum, r) => sum + r.passRate, 0) / testReports.length;
      if (avgPassRate < 0.9) {
        recommendations.push(`Test pass rate is below 90% (currently ${(avgPassRate * 100).toFixed(1)}%). Address failing tests before release.`);
      }
    }

    const regressions = this.getPerformanceRegressions('detected');
    if (regressions.length > 0) {
      recommendations.push(`${regressions.length} performance regression(s) detected. Review performance metrics immediately.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All systems operating normally. Continue monitoring key metrics.');
    }

    return recommendations;
  }

  getIterationHistory(limit: number = 10): IterationCycle[] {
    return this.getIterationCycles().slice(0, limit);
  }
}
