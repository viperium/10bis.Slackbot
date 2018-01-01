import { Commons } from "./commons";
import { HipChatModule } from "./hipChatModule";

// hipChatMessage.js

/*
HipChat Request:
{
    "event": "room_message",
    "item": {
        "message": {
            "date": "2015-01-20T22:45:06.662545+00:00",
            "from": {
                "id": 1661743,
                "mention_name": "Blinky",
                "name": "Blinky the Three Eyed Fish"
            },
            "id": "00a3eb7f-fac5-496a-8d64-a9050c712ca1",
            "mentions": [],
            "message": "/10bis דיקסי",
            "type": "message"
        },
        "room": {
            "id": 1147567,
            "name": "The Weather Channel"
        }
    },
    "webhook_id": 578829
}


HipChat Response:
{
    "color": "green",
    "message": "It's going to be sunny tomorrow! (yey)",
    "notify": false,
    "message_format": "text",
    "card": {
        {
            "style": "link",
            "url": "http://www.website.com/some-article",
            "id": "c253adc6-11fa-4941-ae26-7180d67e814a",
            "title": "Sample link card",
            "description": "This is some information about the link shared.\nin 2 lines of text",
            "icon": {
                "url": "http://bit.ly/1Qrfs1M"
            },
            "date": 1453867674631,
            "thumbnail": {
            static getInstance(): any {
        throw new Error("Method not implemented.");
    }
        "url": "http://bit.ly/1TmKuKQ",
                "url@2x": "http://b    static getInstance: any;
it.ly/1TmKuKQ",
                "width": 1193,
                "height": 564
            }
        }
    }
}
*/
var uuid = require("uuid/v4");

var commandOperator = "/10bis";

export class HipChatMessageFormatter implements Commons.MessageFormatter {

    private static _instance: HipChatMessageFormatter = new HipChatMessageFormatter();

    constructor() {
        if (HipChatMessageFormatter._instance) {
            throw new Error("Error: Instantiation failed: Use HipChatMessageFormatter.getInstance() instead of new.");
        }
        HipChatMessageFormatter._instance = this;
    }

    public static getInstance(): HipChatMessageFormatter {
        return HipChatMessageFormatter._instance;
    }

    getDefaultResponse(): Commons.TenBisResponse {
        return new HipChatModule.HipChatResponse(
            "green",
            Commons.DefaultResponseString,
            false,
            "text");
    }

    getErrorMessage(restaurantName: string): Commons.TenBisResponse {
        var restaurantString = "";
        if (restaurantName) {
            restaurantString = " for: " + restaurantName;
        }

        return new HipChatModule.HipChatResponse(
            "red",
            "No Restaurants Found" + restaurantString,
            false,
            "text");
    }

    getRestaurantName(req: HipChatModule.HipChatReq): string {
        if (req && req.body && req.body.item && req.body.item.message && req.body.item.message.message) {
            var message = req.body.item.message.message;

            message = message.slice(commandOperator.length + 1); //get the value

            return message;
        }

        return null;
    }
    generateSearchResponse(restaurants: Commons.Restaurant[]): Commons.TenBisResponse {
        var title = "Found " + restaurants.length + " restaurants";
        var restaurantText = "";

        if (restaurants.length > 0) {
            title += "\n";
            restaurants.forEach(function (restaurant : Commons.Restaurant, index: number) {
                var suffix = "";
                if (index < restaurants.length) {
                    suffix = "\n\n";
                }
                restaurantText += "[" + (index + 1) + "] " + restaurant.RestaurantName +
                " : https://www.10bis.co.il/Restaurants/Menu/Delivery?ResId=" + restaurant.RestaurantId + suffix;
            });
        }

        if (restaurants.length === 1) {
            return this.getSuccessMessage(title, restaurants[0]);
        }
        return this.getSuccessMessage(title + restaurantText, null);
    }

    generateTotalOrdersResponse(restaurants: Commons.Restaurant[]): HipChatModule.HipChatResponse {
        var restaurantsString = "";
        if (restaurants.length > 0) {

            // Create a list
            restaurants.forEach(function (restaurant : Commons.Restaurant, index : number) {
                restaurantsString += "[" + (index + 1) + "] " + restaurant.RestaurantName +
                " : https://www.10bis.co.il/Restaurants/Menu/Delivery?ResId=" + restaurant.RestaurantId;
                restaurantsString += "\n";
                restaurantsString += "מינימום הזמנה: " + restaurant.MinimumOrder + "\t הוזמן עד כה: " + restaurant.PoolSum;
            });
        } else {
            restaurantsString = "No pool order restaurants found";
        }

        let response = new HipChatModule.HipChatResponse(
            "green",
            restaurantsString,
            false,
            "text"
        );

        return response;
    }

    isValidMessage(req: HipChatModule.HipChatReq): boolean {
        if (req && req.body && req.body.item && req.body.item.message && req.body.item.message.message) {
            return req.body.item.message.message.startsWith(commandOperator);
        }

        return false;
    }

    generateDescription(restaurant : Commons.Restaurant): string {
        let description = "";
        description += restaurant.RestaurantCuisineList + "\n";
        description += "מינימום הזמנה: " + restaurant.MinimumOrder;
        return description;
    }

    generateRestaurantCard (restaurant : Commons.Restaurant) : HipChatModule.HipChatCard {
        return new HipChatModule.HipChatCard(
            "link",
            "https://www.10bis.co.il/Restaurants/Menu/Delivery?ResId=" + restaurant.RestaurantId,
            uuid(),
            restaurant.RestaurantName,
            this.generateDescription(restaurant),
            new HipChatModule.UrlObject(restaurant.RestaurantLogoUrl),
            (new Date()).getTime(),
            new HipChatModule.UrlObject(restaurant.RestaurantLogoUrl)
        );
    }

    getSuccessMessage (text : string, restaurant : Commons.Restaurant) : HipChatModule.HipChatResponse {
        var response = new HipChatModule.HipChatResponse("green", text, false, "text");

        if (restaurant) {
            response.card = this.generateRestaurantCard(restaurant);
        }
        return response;
    }
}
