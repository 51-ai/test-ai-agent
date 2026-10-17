import { CleanedData, AnnotatedData } from './types';

export class AnnotationManager {
  private annotations: Map<string, AnnotatedData> = new Map();

  createAnnotation(
    cleanedData: CleanedData,
    labels: Record<string, string>,
    options: {
      intent?: string;
      entities?: Array<{ name: string; value: string }>;
      annotator?: string;
    } = {}
  ): AnnotatedData {
    const annotation: AnnotatedData = {
      id: `annotated_${cleanedData.id}`,
      cleanedDataId: cleanedData.id,
      labels,
      intent: options.intent,
      entities: options.entities,
      quality: this.assessAnnotationQuality(labels, options.intent, options.entities),
      annotator: options.annotator,
      annotatedAt: new Date()
    };

    this.annotations.set(annotation.id, annotation);
    return annotation;
  }

  updateAnnotation(annotationId: string, updates: Partial<AnnotatedData>): AnnotatedData | null {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return null;

    const updated: AnnotatedData = {
      ...annotation,
      ...updates
    };

    this.annotations.set(annotationId, updated);
    return updated;
  }

  verifyAnnotation(annotationId: string, verifier: string): AnnotatedData | null {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return null;

    const verified: AnnotatedData = {
      ...annotation,
      verified: true,
      verifiedBy: verifier,
      verifiedAt: new Date()
    };

    this.annotations.set(annotationId, verified);
    return verified;
  }

  getAnnotation(id: string): AnnotatedData | undefined {
    return this.annotations.get(id);
  }

  getAnnotations(): AnnotatedData[] {
    return Array.from(this.annotations.values());
  }

  getVerifiedAnnotations(): AnnotatedData[] {
    return this.getAnnotations().filter(a => a.verified);
  }

  deleteAnnotation(id: string): boolean {
    return this.annotations.delete(id);
  }

  private assessAnnotationQuality(
    labels: Record<string, string>,
    intent?: string,
    entities?: Array<{ name: string; value: string }>
  ): number {
    let quality = 50;

    if (intent) quality += 20;
    if (entities && entities.length > 0) quality += 15;
    if (Object.keys(labels).length > 0) quality += 15;

    return Math.min(100, quality);
  }

  exportForTraining(onlyVerified: boolean = true): Array<{ input: string; output: string }> {
    let annotations = this.getAnnotations();
    
    if (onlyVerified) {
      annotations = annotations.filter(a => a.verified);
    }

    return annotations.map(a => ({
      input: '',
      output: ''
    }));
  }

  clear(): void {
    this.annotations.clear();
  }
}
