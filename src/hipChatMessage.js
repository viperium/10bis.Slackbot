var guid = require('guid');

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
                "url": "http://bit.ly/1TmKuKQ",
                "url@2x": "http://bit.ly/1TmKuKQ",
                "width": 1193,
                "height": 564
            }
        }
    }
}
*/

var commandOperator = "/10bis";

module.exports = {
    getErrorMessage: function(restaurantName) {
        var restaurantString = "";
        if (restaurantName)
            restaurantString = " for: " + restaurantName;

        var body = {
            color: "red",
            message: 'No Restaurants Found' + restaurantString,
            notify: false,
            message_format: "text"
        };

        return body;
    },

    getRestaurantName: function(req) {
        if (req && req.body && req.body.item && req.body.item.message && req.body.item.message.message) {
            var message = req.body.item.message.message;

            message = message.slice(commandOperator.length + 1); //get the value

            return message;
        }

        return null;
    },

    isValidMessage: function(req) {
        if (req && req.body && req.body.item && req.body.item.message && req.body.item.message.message) {
            return req.body.item.message.message.startsWith(commandOperator);
        }

        return false;
    },

    generateDescription: function(restaurant){
        var description = "";
        description += restaurant.RestaurantCuisineList + "\n";
        description += "מינימום הזמנה: " + restaurant.MinimumOrder;
        return description;
    },

    getSuccessMessage: function(text, restaurant) {
        var body = {
            color: "green",
            message: text,
            notify: false,
            message_format: "text"
        }

        if (restaurant){
            var card =
            {
                style: "link",
                url: "https://www.10bis.co.il/Restaurants/Menu/Delivery?ResId=" + restaurant.RestaurantId,
                id: guid.create(),
                title: restaurant.RestaurantName,
                description: this.generateDescription(restaurant),
                icon: {
                    "url": restaurant.RestaurantLogoUrl
                },
                date: (new Date).getTime(),
                thumbnail: {
                    url: restaurant.RestaurantLogoUrl
                }
            }

            body.card = card;
        }
        return body;
    },

    generateResponse: function(restaurants){
        var title = 'Found ' + restaurants.length + ' restaurants';
        var restaurantText = '';

        if (restaurants.length > 0){
            title += "\n";
            restaurants.forEach(function(restaurant, index){
                var suffix = '';
                if (index < restaurants.length)
                    suffix = '\n\n';
                restaurantText += '[' + (index + 1) + '] ' + restaurant.RestaurantName + " : https://www.10bis.co.il/Restaurants/Menu/Delivery?ResId=" + restaurant.RestaurantId + suffix;
            });
        }

        if (restaurants.length == 1)
            return this.getSuccessMessage(title, restaurants[0]);
        return this.getSuccessMessage(title + restaurantText, null);
    }

};