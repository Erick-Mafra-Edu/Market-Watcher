/**
 * Sentiment Analysis Service
 * Simple NLP-based sentiment analysis for news articles
 */

// Positive and negative word lists for sentiment analysis
const POSITIVE_WORDS = [
  'gain', 'gains', 'profit', 'profits', 'growth', 'surge', 'rally', 'rise', 'rises', 'rising',
  'up', 'increase', 'increases', 'high', 'higher', 'strong', 'stronger', 'beat', 'beats',
  'success', 'successful', 'win', 'winning', 'positive', 'optimistic', 'bullish', 'breakthrough',
  'record', 'best', 'excellent', 'outstanding', 'impressive', 'soar', 'soaring', 'jump', 'climbs',
  'advance', 'advances', 'boost', 'recovery', 'recovered', 'momentum', 'upgrade', 'upgraded'
];

const NEGATIVE_WORDS = [
  'loss', 'losses', 'lose', 'losing', 'fall', 'falls', 'falling', 'drop', 'drops', 'decline',
  'declines', 'down', 'decrease', 'decreases', 'low', 'lower', 'weak', 'weaker', 'miss', 'misses',
  'fail', 'failure', 'failed', 'negative', 'pessimistic', 'bearish', 'crash', 'plunge', 'plunges',
  'tumble', 'sink', 'sinks', 'slump', 'worst', 'poor', 'disappointing', 'concern', 'concerns',
  'worried', 'risk', 'risks', 'threat', 'threats', 'downgrade', 'downgraded', 'cut', 'cuts'
];

const INTENSITY_MODIFIERS = {
  'very': 1.5,
  'extremely': 2.0,
  'highly': 1.5,
  'significantly': 1.5,
  'substantially': 1.5,
  'moderately': 0.8,
  'slightly': 0.5,
  'somewhat': 0.6,
  'not': -1.0,
  'never': -1.5,
  'no': -0.8,
};

export class SentimentAnalyzer {
  /**
   * Analyze sentiment of a text
   * Returns a score between -1 (very negative) and 1 (very positive)
   */
  analyzeSentiment(text: string): { score: number; label: string; confidence: number } {
    if (!text) {
      return { score: 0, label: 'neutral', confidence: 0 };
    }

    // Convert to lowercase and split into words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);

    let positiveScore = 0;
    let negativeScore = 0;
    let modifier = 1.0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Check for intensity modifiers
      if (INTENSITY_MODIFIERS[word] !== undefined) {
        modifier = INTENSITY_MODIFIERS[word];
        continue;
      }

      // Check for positive words
      if (POSITIVE_WORDS.includes(word)) {
        positiveScore += (1.0 * modifier);
        modifier = 1.0; // Reset modifier
        continue;
      }

      // Check for negative words
      if (NEGATIVE_WORDS.includes(word)) {
        negativeScore += (1.0 * Math.abs(modifier));
        modifier = 1.0; // Reset modifier
        continue;
      }

      // Reset modifier if no sentiment word found
      modifier = 1.0;
    }

    // Calculate final score
    const totalScore = positiveScore + negativeScore;
    let normalizedScore = 0;

    if (totalScore > 0) {
      normalizedScore = (positiveScore - negativeScore) / totalScore;
    }

    // Normalize to -1 to 1 range
    normalizedScore = Math.max(-1, Math.min(1, normalizedScore));

    // Determine label
    let label = 'neutral';
    if (normalizedScore > 0.2) {
      label = 'positive';
    } else if (normalizedScore < -0.2) {
      label = 'negative';
    }

    // Calculate confidence based on number of sentiment words found
    const confidence = Math.min(1.0, totalScore / 5.0);

    return {
      score: parseFloat(normalizedScore.toFixed(4)),
      label,
      confidence: parseFloat(confidence.toFixed(2)),
    };
  }

  /**
   * Analyze sentiment of news title and description combined
   */
  analyzeNews(title: string, description?: string): { score: number; label: string; confidence: number } {
    // Give more weight to title (60%) than description (40%)
    const titleAnalysis = this.analyzeSentiment(title);
    
    if (!description) {
      return titleAnalysis;
    }

    const descAnalysis = this.analyzeSentiment(description);
    
    const combinedScore = (titleAnalysis.score * 0.6) + (descAnalysis.score * 0.4);
    const combinedConfidence = (titleAnalysis.confidence * 0.6) + (descAnalysis.confidence * 0.4);

    let label = 'neutral';
    if (combinedScore > 0.2) {
      label = 'positive';
    } else if (combinedScore < -0.2) {
      label = 'negative';
    }

    return {
      score: parseFloat(combinedScore.toFixed(4)),
      label,
      confidence: parseFloat(combinedConfidence.toFixed(2)),
    };
  }
}
