import { dataLoaderHandler } from ".."
import { stockEvaluator } from "../stock-evaluator";

describe("handler tests", () => {

    it("trigger handler", async() => {
        await dataLoaderHandler();
    }, 20000)

    it("stock evaluation", async() => {
        await stockEvaluator();
    }, 30000)
})