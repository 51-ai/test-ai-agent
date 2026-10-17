import { FeedbackData, ImprovementSuggestion } from './types';

export class FeedbackCollector {
  private feedback: Map<string, FeedbackData> = new Map();

  addFeedback(feedback: FeedbackData): void {
    const enhanced = this.enhanceFeedback(feedback);
    this.feedback.set(enhanced.id, enhanced);
  }

  getFeedback(id: string): FeedbackData | undefined {
    return this.feedback.get(id);
  }

  getFeedbacks(options: {
    startDate?: Date;
    endDate?: Date;
    minRating?: number;
    maxRating?: number;
    category?: FeedbackData['category'];
    priority?: FeedbackData['priority'];
    tags?: string[];
    limit?: number;
  } = {}): FeedbackData[] {
    let results = Array.from(this.feedback.values());

    if (options.startDate) {
      results = results.filter(f => f.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      results = results.filter(f => f.timestamp <= options.endDate!);
    }

    if (options.minRating !== undefined) {
      results = results.filter(f => (f.rating || 0) >= options.minRating!);
    }

    if (options.maxRating !== undefined) {
      results = results.filter(f => (f.rating || 5) <= options.maxRating!);
    }

    if (options.category) {
      results = results.filter(f => f.category === options.category);
    }

    if (options.priority) {
      results = results.filter(f => f.priority === options.priority);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(f => 
        f.tags && options.tags!.some(tag => f.tags!.includes(tag))
      );
    }

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getFeedbackStats() {
    const feedbacks = this.getFeedbacks();
    const total = feedbacks.length;

    if (total === 0) {
      return {
        total: 0,
        averageRating: 0,
        helpfulRate: 0,
        feedbacksWithComments: 0,
        categoryBreakdown: {},
        priorityBreakdown: {},
        tagBreakdown: {}
      };
    }

    const ratings = feedbacks.filter(f => f.rating !== undefined).map(f => f.rating!);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    const helpfulCount = feedbacks.filter(f => f.helpful).length;
    const commentsCount = feedbacks.filter(f => f.comment).length;

    const categoryBreakdown: Record<string, number> = {};
    const priorityBreakdown: Record<string, number> = {};
    const tagBreakdown: Record<string, number> = {};

    for (const f of feedbacks) {
      const category = f.category || 'other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

      const priority = f.priority || 'medium';
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;

      if (f.tags) {
        for (const tag of f.tags) {
          tagBreakdown[tag] = (tagBreakdown[tag] || 0) + 1;
        }
      }
    }

    return {
      total,
      averageRating,
      helpfulRate: helpfulCount / total,
      feedbacksWithComments: commentsCount,
      categoryBreakdown,
      priorityBreakdown,
      tagBreakdown
    };
  }

  exportForTraining(): Array<{ input: string; output: string; feedback: FeedbackData }> {
    return this.getFeedbacks()
      .filter(f => f.rating !== undefined && f.rating >= 3)
      .map(f => ({
        input: '',
        output: '',
        feedback: f
      }));
  }

  generateImprovementSuggestions(): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const stats = this.getFeedbackStats();

    if (stats.total > 0) {
      if (stats.averageRating < 3.5) {
        suggestions.push({
          id: `suggestion_${Date.now()}_1`,
          type: 'prompting',
          description: 'Review prompt engineering strategies due to below-average ratings',
          priority: 'high',
          expectedImpact: 0.8,
          implementationCost: 0.3,
          status: 'suggested'
        });
      }

      if (stats.helpfulRate < 0.6) {
        suggestions.push({
          id: `suggestion_${Date.now()}_2`,
          type: 'training_data',
          description: 'Gather more relevant training data to improve helpfulness',
          priority: 'high',
          expectedImpact: 0.7,
          implementationCost: 0.5,
          status: 'suggested'
        });
      }

      const categories = Object.entries(stats.categoryBreakdown);
      for (const [category, count] of categories) {
        if (count > stats.total * 0.3 && category !== 'other') {
          suggestions.push({
            id: `suggestion_${Date.now()}_${category}`,
            type: 'training_data',
            description: `Focus on improving ${category} - represents ${((count/stats.total)*100).toFixed(1)}% of feedback`,
            priority: 'medium',
            expectedImpact: 0.6,
            implementationCost: 0.4,
            status: 'suggested'
          });
        }
      }
    }

    return suggestions;
  }

  analyzeFeedbackTrends(days: number = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentFeedbacks = this.getFeedbacks({ startDate: cutoff });
    
    const weeklyTrends: Record<string, { avgRating: number; count: number }> = {};
    
    for (const f of recentFeedbacks) {
      const weekKey = this.getWeekKey(f.timestamp);
      if (!weeklyTrends[weekKey]) {
        weeklyTrends[weekKey] = { avgRating: 0, count: 0 };
      }
      
      if (f.rating !== undefined) {
        weeklyTrends[weekKey].avgRating = 
          (weeklyTrends[weekKey].avgRating * weeklyTrends[weekKey].count + f.rating) / 
          (weeklyTrends[weekKey].count + 1);
      }
      weeklyTrends[weekKey].count++;
    }

    return {
      weeklyTrends,
      totalRecent: recentFeedbacks.length,
      trendingUp: this.isTrendingUp(weeklyTrends)
    };
  }

  private getWeekKey(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return `${monday.getFullYear()}-${monday.getMonth()+1}-${monday.getDate()}`;
  }

  private isTrendingUp(trends: Record<string, { avgRating: number }>): boolean {
    const weeks = Object.keys(trends).sort();
    if (weeks.length < 2) return false;
    
    const first = trends[weeks[0]].avgRating;
    const last = trends[weeks[weeks.length-1]].avgRating;
    return last > first;
  }

  clearOldFeedbacks(days: number = 30): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, feedback] of this.feedback.entries()) {
      if (feedback.timestamp < cutoff) {
        this.feedback.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  private enhanceFeedback(feedback: FeedbackData): FeedbackData {
    const enhanced = { ...feedback };
    
    if (!enhanced.category) {
      enhanced.category = this.detectCategory(feedback);
    }

    if (!enhanced.priority) {
      enhanced.priority = this.detectPriority(feedback);
    }

    if (!enhanced.tags) {
      enhanced.tags = this.extractTags(feedback);
    }

    return enhanced;
  }

  private detectCategory(feedback: FeedbackData): FeedbackData['category'] {
    const comment = (feedback.comment || '').toLowerCase();
    
    if (comment.includes('速度') || comment.includes('slow') || comment.includes('fast')) {
      return 'speed';
    }
    
    if (comment.includes('不准确') || comment.includes('incorrect') || comment.includes('wrong')) {
      return 'accuracy';
    }
    
    if (comment.includes('不相关') || comment.includes('irrelevant')) {
      return 'relevance';
    }
    
    if (comment.includes('界面') || comment.includes('界面') || comment.includes('usability')) {
      return 'usability';
    }
    
    return 'other';
  }

  private detectPriority(feedback: FeedbackData): FeedbackData['priority'] {
    if (feedback.rating !== undefined && feedback.rating <= 2) {
      return 'high';
    }
    
    if (feedback.rating !== undefined && feedback.rating === 3) {
      return 'medium';
    }
    
    return 'low';
  }

  private extractTags(feedback: FeedbackData): string[] {
    const tags: string[] = [];
    const comment = (feedback.comment || '').toLowerCase();
    
    if (comment.includes('bug')) tags.push('bug');
    if (comment.includes('feature')) tags.push('feature_request');
    if (comment.includes('improve')) tags.push('improvement');
    if (comment.includes('question')) tags.push('question');
    
    return tags;
  }
}
