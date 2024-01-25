export default class Player {
    hive;
    standardRules = true;
    constructor(hive) {
        this.hive = hive;
    }
    initPlayerTurn() {
    }
    reset(standardRules) {
        this.standardRules = standardRules;
    }
}
