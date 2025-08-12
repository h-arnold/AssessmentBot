// Assessment.gs

/**
 * Assessment Class
 * 
 * Represents the assessment for a specific criterion.
 */
class Assessment {
    /**
     * Constructs an Assessment instance.
     * @param {number} score - Score between 0 and 5.
     * @param {string} reasoning - Reasoning provided by the LLM.
     */
    constructor(score, reasoning) {
        this.score = score;         // integer between 0 and 5
        this.reasoning = reasoning; // string explanation
    }

    /**
     * Serializes the Assessment instance to a JSON object.
     * @return {Object} - The JSON representation of the Assessment.
     */
    toJSON() {
        return {
            score: this.score,
            reasoning: this.reasoning
        };
    }

    /**
     * Deserializes a JSON object to an Assessment instance.
     * @param {Object} json - The JSON object representing an Assessment.
     * @return {Assessment} - The Assessment instance.
     */
    static fromJSON(json) {
        const { score, reasoning } = json;
        return new Assessment(score, reasoning);
    }
}
