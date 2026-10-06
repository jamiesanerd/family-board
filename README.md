# family-board

We had DAKboard running on a screen in the house for our calendar and the weather, and I wanted something lighter that looked nicer, so I made my own. It shows the next month of events, the time, the weather and a photo, printed in riso-style ink on paper. The paper goes dark at night.

It's just a web page and a small server, so put it on whatever screen you have. Mine is a Raspberry Pi with Firefox in kiosk mode.

## Run it

You need Node 22.18 or newer.

1. Install the packages.

        npm install

2. Copy the example config.

        cp board.config.example.json board.config.json

3. Fill in `board.config.json`. The settings are below.
4. Start the server.

        npm start

5. Open http://localhost:8788.

## Config

- `calendars` holds one or more calendars, and each one has a `name` and a `url`. The url is the calendar's secret iCal link. It stays on the server and never goes to the page. The name only shows up when that calendar can't be reached.
  - Google Calendar: open the calendar's settings and copy "Secret address in iCal format".
  - iCloud: share the calendar as a public calendar and copy the link. `webcal://` links work.
  - Outlook: publish the calendar and copy the ICS link.
- `latitude` and `longitude` set where the weather is for. You can right-click a spot in most map apps to copy them.
- `temperatureUnit` is `fahrenheit` or `celsius`, and the default is `fahrenheit`.
- `port` sets the port, and the default is 8788.

The calendars and the weather refresh every 15 minutes. If one can't be reached, the page keeps the last thing it got and says which one is behind.

The weather comes from [Open-Meteo](https://open-meteo.com).

## Photos

Put `.jpg` or `.png` files in a `photos/` folder next to this README. Feel free to use whatever other photo service you want to put the photos there, I wanted it simple and just uploaded a bunch of pictures of my cats.

## Security

There's basically none, definitely don't run this on the public internet. I have this running on the same machine that shows the window in a browser pointed at localhost.

## Tests

Run the tests and the type check with:

    npm test
    npm run check

## License

The code has the MIT license, see `LICENSE.txt`. The fonts have the SIL Open Font License, see `public/fonts/NOTICE.txt`. The icons are from [pixelarticons](https://github.com/halfmage/pixelarticons) and [HackerNoon's Pixel Icon Library](https://github.com/hackernoon/pixel-icon-library), which both have the MIT license, see `public/icons/NOTICE.txt`.
