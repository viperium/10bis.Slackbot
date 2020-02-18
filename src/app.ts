import { Response } from "express";
import * as winston from "winston";
import {
  Commons,
  FilterByRestaurantName,
  SortRestaurantsByDistance,
  GenerateSearchRequest,
  VerifyMessage,
  ErrorPromiseWrapper,
  GenerateGetTotalOrdersRequest,
  RequestGetWrapper,
  FilterTotalOrders
} from "./commons";
import { Constants } from "./constants";
import { HipChatMessageFormatter } from "./hipChatMessage";
import { SlackMessageFormatter } from "./slackMessage";
import { ExpirationStrategy, MemoryStorage } from "node-ts-cache";

const myCache = new ExpirationStrategy(new MemoryStorage());
const cacheTTL: number = 60 * 60 * 24;
winston.configure({
  level: process.env.LOG_LEVEL,
  transports: [new winston.transports.Console()]
});

export class App {
  public express;
  private messageFormatters: Commons.MessageFormatter[];
  constructor() {
    winston.debug("Booting %s", Constants.APP_NAME);
    this.messageFormatters = [
      HipChatMessageFormatter.getInstance(),
      SlackMessageFormatter.getInstance()
    ];
  }

  process(req: Commons.Request, res: Response): Promise<void> {
    let messageFormatter = VerifyMessage(req, this.messageFormatters);
    if (!messageFormatter) {
      res.status(400).send(Constants.INVALID_MESSAGE_STRING);
      return ErrorPromiseWrapper(Constants.INVALID_MESSAGE_STRING);
    }

    let restaurantName = messageFormatter.getRestaurantName(req);
    if (!restaurantName) {
      const body = messageFormatter.getErrorMessage(null);
      res.status(400).send(body);
      return ErrorPromiseWrapper(Constants.INVALID_MESSAGE_STRING);
    }

    restaurantName = restaurantName.trim();

    if (
      restaurantName.toLowerCase() === Constants.TOTAL_KEYWORD.toLowerCase()
    ) {
      return this.getTotalOrders(res, messageFormatter);
    } else {
      return this.search(res, messageFormatter, restaurantName, true);
    }
  }

  //@Cache(myCache, { ttl: 60 * 60 * 24 }) //ttl = 24 hr
  search(
    res: Response,
    messageFormatter: Commons.MessageFormatter,
    restaurantName: string,
    useCache?: boolean
  ): Promise<void> {
    if (!restaurantName || restaurantName.length === 0) {
      // Behavior for empty command ("/10bis" with no content)
      let body: Commons.TenBisResponse = messageFormatter.getDefaultResponse();
      res.status(400).send(body);
      return ErrorPromiseWrapper(Constants.INVALID_MESSAGE_STRING);
    }

    let cleanRestaurantName: string = restaurantName;
    let useExactRestaurantName: boolean = false;
    let exactRestaurantName: string = this.getExactRestaurantName(
      restaurantName
    );
    if (exactRestaurantName) {
      cleanRestaurantName = exactRestaurantName;
      useExactRestaurantName = true;
    }

    if (useCache) {
      return myCache
        .getItem<Commons.Restaurant[]>(cleanRestaurantName)
        .then(cachedData => {
          if (cachedData) {
            const resBody = messageFormatter.generateSearchResponse(
              FilterByRestaurantName(
                SortRestaurantsByDistance(cachedData),
                useExactRestaurantName,
                cleanRestaurantName
              )
            );
            res.json(resBody);
            return;
          } else {
            return this.runSearch(
              res,
              messageFormatter,
              restaurantName,
              useCache
            );
          }
        });
    }

    return this.runSearch(res, messageFormatter, restaurantName, useCache);
  }

  private runSearch(
    res: Response,
    messageFormatter: Commons.MessageFormatter,
    restaurantName: string,
    useCache: boolean
  ): Promise<void> {
    let useExactRestaurantName: boolean = false;
    let exactRestaurantName: string = this.getExactRestaurantName(
      restaurantName
    );
    if (exactRestaurantName) {
      restaurantName = exactRestaurantName;
      useExactRestaurantName = true;
    }

    let parsed_url: string = GenerateSearchRequest(restaurantName);

    return RequestGetWrapper(parsed_url)
      .then(body => {
        let data = JSON.parse(body);

        if (!data || !data.length || data.length < 1) {
          const badResBody = messageFormatter.getErrorMessage(restaurantName);
          res.json(badResBody);
          return;
        }

        if (useCache) {
          return myCache
            .setItem(restaurantName, data, { ttl: cacheTTL })
            .then(() => {
              const resBody = messageFormatter.generateSearchResponse(
                FilterByRestaurantName(
                  SortRestaurantsByDistance(data),
                  useExactRestaurantName,
                  restaurantName
                )
              );
              res.json(resBody);
            });
        } else {
          const resBody = messageFormatter.generateSearchResponse(
            FilterByRestaurantName(
              SortRestaurantsByDistance(data),
              useExactRestaurantName,
              restaurantName
            )
          );
          res.json(resBody);
        }
      })
      .catch(err => {
        if (err) {
          winston.debug("Error in Search: " + err);
        } else {
          winston.debug("Error in Search");
        }
        res.status(400).send(Constants.ERROR_STRING);
      });
  }

  getTotalOrders(
    res: Response,
    messageFormatter: Commons.MessageFormatter
  ): Promise<void> {
    let parsed_url: string = GenerateGetTotalOrdersRequest();
    winston.debug("Total Orders Url: " + parsed_url);

    let requestPromise: Promise<string> = RequestGetWrapper(parsed_url);
    return requestPromise
      .then(body => {
        let data: Commons.Restaurant[] = JSON.parse(body);

        if (!data || !(data instanceof Array)) {
          const resBody = messageFormatter.getErrorMessage(null);
          res.json(resBody);
          return;
        }

        let restaurants: Commons.Restaurant[] = data.filter(FilterTotalOrders);

        const resBody = messageFormatter.generateTotalOrdersResponse(
          FilterByRestaurantName(restaurants, false, null)
        );
        res.json(resBody);
      })
      .catch(err => {
        if (err) {
          winston.debug("Error in Get Total Orders: " + err);
        } else {
          winston.debug("Error in Get Total Orders");
        }
        res.status(400).send(Constants.ERROR_STRING);
      });
  }

  // Return the exact restaurant name if it's surrounded with double quotes, otherwise return NULL
  getExactRestaurantName(restaurantName: string): string {
    let exactRestaurantName: string;
    if (/^".*"$/.test(restaurantName)) {
      // Cleanup restaurant name from quotes
      exactRestaurantName = restaurantName.replace(/["]+/g, "");
    } else if (/^״.*״$/.test(restaurantName)) {
      // Cleanup restaurant name from quotes
      exactRestaurantName = restaurantName.replace(/[״]+/g, "");
    } else if (/^'.*'$/.test(restaurantName)) {
      // Cleanup restaurant name from quotes
      exactRestaurantName = restaurantName.replace(/[']+/g, "");
    }
    return exactRestaurantName;
  }
}
export default new App();
