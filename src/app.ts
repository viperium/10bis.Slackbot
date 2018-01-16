import * as bodyParser from "body-parser";
import { Request, Response, NextFunction } from "express";
import * as winston from "winston";
import { Commons } from "./commons";
import { Constants } from "./constants";
import { HipChatMessageFormatter } from "./hipChatMessage";
import { SlackMessageFormatter } from "./slackMessage";

winston.level = process.env.LOG_LEVEL;

export class App {
    public express;
    private messageFormatters : Commons.MessageFormatter[];
    constructor (formatter? : Commons.MessageFormatter) {
      winston.debug("Booting %s", Constants.APP_NAME);
      this.messageFormatters = [HipChatMessageFormatter.getInstance(), SlackMessageFormatter.getInstance()];
    }

    process (req: Commons.Request, res: Response) : Promise<void> {
        let messageFormatter = Commons.verifyMessage(req, this.messageFormatters);
        if (!messageFormatter) {
            res.status(400).send(Constants.INVALID_MESSAGE_STRING);
            return Commons.ErrorPromiseWrapper(Constants.INVALID_MESSAGE_STRING);
        }


        let restaurantName = messageFormatter.getRestaurantName(req);

        if (!restaurantName) {
            const body = messageFormatter.getErrorMessage(null);
            res.status(400).send(body);
            return Commons.ErrorPromiseWrapper(Constants.INVALID_MESSAGE_STRING);
        }

        restaurantName = restaurantName.trim();

        if (restaurantName.toLowerCase() === Constants.TOTAL_KEYWORD.toLowerCase()) {
            return this.getTotalOrders(res, messageFormatter);
        } else {
            return this.search(res, messageFormatter, restaurantName);
        }
    }

    search (res : Response, messageFormatter : Commons.MessageFormatter, restaurantName : string) : Promise<void> {
        if (!restaurantName || restaurantName.length === 0) { // Behavior for empty command ("/10bis" with no content)
            let body : Commons.TenBisResponse = messageFormatter.getDefaultResponse();
            res.status(400).send(body);
            return Commons.ErrorPromiseWrapper(Constants.INVALID_MESSAGE_STRING);
        }

        let parsed_url : string = Commons.generateSearchRequest(restaurantName);

        return Commons.RequestGetWrapper(parsed_url)
            .then((body) => {
                let data = JSON.parse(body);

                if (!data || !data.length || data.length < 1) {
                    const badResBody = messageFormatter.getErrorMessage(restaurantName);
                    res.json(badResBody);
                    return;
                }

                const resBody = messageFormatter.generateSearchResponse(Commons.filterByRestaurantName(Commons.sortRestaurantsByDistance(data)));
                res.json(resBody);
            }).catch((err) => {
                if (err) {
                    winston.debug("Error in Search: " + err);
                } else {
                    winston.debug("Error in Search");
                }
                res.status(400).send(Constants.ERROR_STRING);
            });
    }

    getTotalOrders (res : Response, messageFormatter : Commons.MessageFormatter) : Promise<void> {
            let parsed_url : string = Commons.generateGetTotalOrdersRequest();
            winston.debug("Total Orders Url: " + parsed_url);

            let requestPromise : Promise<string> = Commons.RequestGetWrapper(parsed_url);
            return requestPromise.then((body) => {
                let data : Commons.Restaurant[] = JSON.parse(body);

                if (!data || !data.length || data.length < 1) {
                    const resBody = messageFormatter.getErrorMessage(null);
                    res.json(resBody);
                    return;
                }

                let restaurants : Commons.Restaurant[] = data.filter(Commons.filterTotalOrders);

                const resBody = messageFormatter.generateTotalOrdersResponse(Commons.filterByRestaurantName(restaurants));
                res.json(resBody);

            }).catch( (err) => {
                if (err) {
                    winston.debug("Error in Get Total Orders: " + err);
                } else {
                    winston.debug("Error in Get Total Orders");
                }
                res.status(400).send(Constants.ERROR_STRING);
            });
    }
}
export default new App();