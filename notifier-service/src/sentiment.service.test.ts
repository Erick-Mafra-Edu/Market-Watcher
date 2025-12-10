/**
 * Tests for Sentiment Analyzer
 */
import { SentimentAnalyzer } from '../sentiment.service';

describe('SentimentAnalyzer', () => {
  let analyzer: SentimentAnalyzer;

  beforeEach(() => {
    analyzer = new SentimentAnalyzer();
  });

  describe('analyzeSentiment', () => {
    it('should identify positive sentiment', () => {
      const result = analyzer.analyzeSentiment('Stock price surges with strong profit gains');
      
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.2);
    });

    it('should identify negative sentiment', () => {
      const result = analyzer.analyzeSentiment('Company reports losses as stock crashes');
      
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(-0.2);
    });

    it('should identify neutral sentiment', () => {
      const result = analyzer.analyzeSentiment('Company announces quarterly meeting');
      
      expect(result.label).toBe('neutral');
      expect(result.score).toBeGreaterThanOrEqual(-0.2);
      expect(result.score).toBeLessThanOrEqual(0.2);
    });

    it('should handle intensity modifiers', () => {
      const result1 = analyzer.analyzeSentiment('Stock rises');
      const result2 = analyzer.analyzeSentiment('Stock rises significantly');
      
      expect(Math.abs(result2.score)).toBeGreaterThan(Math.abs(result1.score));
    });

    it('should handle negation', () => {
      const result1 = analyzer.analyzeSentiment('Stock gains');
      const result2 = analyzer.analyzeSentiment('Stock not gains');
      
      expect(result1.score).toBeGreaterThan(result2.score);
    });

    it('should handle empty text', () => {
      const result = analyzer.analyzeSentiment('');
      
      expect(result.score).toBe(0);
      expect(result.label).toBe('neutral');
      expect(result.confidence).toBe(0);
    });

    it('should calculate confidence based on sentiment words', () => {
      const result1 = analyzer.analyzeSentiment('Stock rises');
      const result2 = analyzer.analyzeSentiment('Stock rises significantly with strong gains and profit surge');
      
      expect(result2.confidence).toBeGreaterThan(result1.confidence);
    });
  });

  describe('analyzeNews', () => {
    it('should analyze both title and description', () => {
      const result = analyzer.analyzeNews(
        'Company reports strong quarterly profits',
        'The company exceeded expectations with record-breaking gains'
      );
      
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.2);
    });

    it('should weight title more than description', () => {
      const result = analyzer.analyzeNews(
        'Stock crashes dramatically',
        'Some analysts remain optimistic'
      );
      
      // Title is negative (60% weight), description is positive (40% weight)
      // Result should be more negative
      expect(result.score).toBeLessThan(0);
    });

    it('should handle missing description', () => {
      const result = analyzer.analyzeNews('Stock surges to new highs');
      
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.2);
    });

    it('should return detailed sentiment information', () => {
      const result = analyzer.analyzeNews(
        'Market rallies with strong investor confidence',
        'Positive economic indicators boost stock prices'
      );
      
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('confidence');
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(['positive', 'negative', 'neutral']).toContain(result.label);
    });
  });

  describe('edge cases', () => {
    it('should handle text with punctuation', () => {
      const result = analyzer.analyzeSentiment('Stock! Price? Rises. Significantly...');
      
      expect(result.label).toBe('positive');
    });

    it('should be case-insensitive', () => {
      const result1 = analyzer.analyzeSentiment('STOCK GAINS');
      const result2 = analyzer.analyzeSentiment('stock gains');
      
      expect(result1.score).toBeCloseTo(result2.score, 2);
    });

    it('should handle repeated words', () => {
      const result = analyzer.analyzeSentiment('gains gains gains');
      
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should normalize extreme scores', () => {
      const result = analyzer.analyzeSentiment('excellent outstanding impressive breakthrough record best');
      
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.score).toBeGreaterThanOrEqual(-1);
    });
  });
});
