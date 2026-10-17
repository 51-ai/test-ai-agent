import { RLState, RLAction, RLExperience } from './types';

export interface PrioritizedExperience {
  experience: RLExperience;
  priority: number;
  tdError?: number;
}

export class ExperienceReplay {
  private buffer: PrioritizedExperience[] = [];
  private maxSize: number;
  private alpha: number;
  private beta: number;

  constructor(maxSize: number = 10000, alpha: number = 0.6, beta: number = 0.4) {
    this.maxSize = maxSize;
    this.alpha = alpha;
    this.beta = beta;
  }

  add(experience: RLExperience, priority: number = 1.0): void {
    const prioritizedExp: PrioritizedExperience = {
      experience,
      priority
    };

    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }

    this.buffer.push(prioritizedExp);
  }

  sample(batchSize: number): RLExperience[] {
    if (this.buffer.length === 0) return [];

    const priorities = this.buffer.map(e => Math.pow(e.priority, this.alpha));
    const totalPriority = priorities.reduce((a, b) => a + b, 0);
    const probabilities = priorities.map(p => p / totalPriority);

    const sampledExperiences: RLExperience[] = [];
    const batchCount = Math.min(batchSize, this.buffer.length);

    for (let i = 0; i < batchCount; i++) {
      const rand = Math.random();
      let cumulative = 0;

      for (let j = 0; j < this.buffer.length; j++) {
        cumulative += probabilities[j];
        if (rand <= cumulative) {
          sampledExperiences.push(this.buffer[j].experience);
          break;
        }
      }
    }

    return sampledExperiences;
  }

  updatePriorities(indices: number[], priorities: number[]): void {
    indices.forEach((idx, i) => {
      if (idx < this.buffer.length) {
        this.buffer[idx].priority = Math.max(priorities[i], 1e-6);
      }
    });
  }

  size(): number {
    return this.buffer.length;
  }

  getAll(): RLExperience[] {
    return this.buffer.map(p => p.experience);
  }

  clear(): void {
    this.buffer = [];
  }
}
