
export default class Timer {
    totalTime;
    #increment;

    constructor(totalTime, increment) {
        this.totalTime = totalTime;
        this.#increment = increment;
    }

}