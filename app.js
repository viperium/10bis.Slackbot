var slackMessage = require('./slackMessage.js');
var hipChatMessage = require('./hipChatMessage.js');
var url = require('url');
var dateFormat = require('dateformat');
var request = require('request');

var generateRequest = function(restaurantName) {
    var now = new Date();

    var parsed_url = url.format({
        pathname: 'https://www.10bis.co.il/Restaurants/SearchRestaurants',
        query: {
            deliveryMethod: 'Delivery',
            ShowOnlyOpenForDelivery: false,
            id: 0,
            pageNum: 0,
            pageSize: 10,
            ShowOnlyOpenForDelivery: false,
            OrderBy: 'Default',
            cuisineType: '',
            CityId: 0,
            StreetId: 0,
            FilterByKosher: false,
            FilterByBookmark: false,
            FilterByCoupon: false,
            Latitude: 0,
            Longitude: 0,
            HouseNumber: '',
            CityName: '',
            StreetAddress: '',
            desiredDateAndTime: dateFormat(now, "dd%2Fmm%2Fyyyy+HH%3AMM%3Ass"),
            timestamp: (new Date).getTime(),
            searchPhrase: restaurantName
        }
    });

    return parsed_url;
}

var generateResponse = function(data) {
    var returnText = 'Found ' + data.length + ' restaurants';
    var restaurantText = '';
    for (i = 0; i < data.length; i++) {
        restaurantText += '[' + (i + 1) + '] ' + data[i].RestaurantName + " : https://www.10bis.co.il/Restaurants/Menu/Delivery?ResId=" + data[i].RestaurantId + '\n\n';
    }

    return [returnText, restaurantText];
}

var verifyMessage = function(req) {
    if (hipChatMessage.isValidMessage(req))
        return hipChatMessage;
    else if (slackMessage.isValidMessage(req))
        return slackMessage;

    return null;
}


module.exports = {
    process: function(req, res) {
        var messageFormatter = verifyMessage(req);
        if (!messageFormatter){
            res.status(400);
            res.send("invalid message");
            return;
        }


        var restaurantName = messageFormatter.getRestaurantName(req);

        if (!restaurantName) {
            var body = messageFormatter.getBadMessage();
            res.send(body);
        }

        var parsed_url = generateRequest(restaurantName);

        request(parsed_url, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                var data = JSON.parse(body);

                if (!data || !data.length || data.length < 1) {
                    var body = messageFormatter.getBadMessage();
                    res.send(body);
                }

                var generatedResponse = generateResponse(data);

                var body = messageFormatter.getSuccessMessage(generatedResponse[0], generatedResponse[1]);

                res.send(body);

            } else {
                res.status(400);
                res.send('None shall pass');
            }
        });
    }
};