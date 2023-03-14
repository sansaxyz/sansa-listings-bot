import * as dotenv from "dotenv";
dotenv.config();
import {
  Client,
  TextChannel,
  EmbedBuilder,
  GatewayIntentBits,
} from "discord.js";
import express from "express";
import axios from "axios";

const app = express();
const PORT = 4000;

// Bot settings:
const TOKEN = process.env.BOT_TOKEN;
const RESERVOIR_API_KEY = process.env.RESERVOIR_API_KEY;
const LISTINGS_CHANNEL_ID = "1084849334362849390";
const SALES_CHANNEL_ID = "1084849348787060836";
const POLL_RATE = 10000; // 10 seconds
const BRAINDROPS_CONTRACT = "0xdFDE78d2baEc499fe18f2bE74B6c287eED9511d7";

// global vars
let timeNow = Math.floor(Date.now());
let lastUpdatedListing = timeNow;

app.listen(PORT, function () {
  // do nothing
});

// Bot setup.
const bot = new Client({
  intents: [GatewayIntentBits.Guilds],
});

bot.login(TOKEN);

bot.on("ready", () => {
  // Once discord bot is ready, initialise watchers
  initWatchers();
});

const initWatchers = () => {
  listingsWatcher();
};

const listingsWatcher = () => {
  // call get listings every x seconds defined in POLL_RATE var
  setInterval(() => {
    try {
      getListings();
    } catch {
      console.error("getListings(): Failed");
    }
  }, POLL_RATE);
};

const getListings = async () => {
  console.log("Getting latest listings...");

  // poll latest listings
  let res = await axios.get("https://api.reservoir.tools/orders/asks/v4", {
    headers: {
      "x-api-key": RESERVOIR_API_KEY,
    },
    params: {
      includeCriteriaMetadata: true,
      normalizeRoyalties: true,
      contracts: BRAINDROPS_CONTRACT,
    },
  });

  let orders = res?.data?.orders;

  let maxTime = 0;
  for (const data of orders) {
    const eventTime = Date.parse(data.createdAt);

    // Only deal with event if it is new
    if (lastUpdatedListing < eventTime) {
      messageHandler(data);
    }

    // Save the time of the latest event from this batch
    if (maxTime < eventTime) {
      maxTime = eventTime;
    }
  }

  // Update latest time vars if batch has new latest time
  if (maxTime > lastUpdatedListing) {
    lastUpdatedListing = maxTime;
  }
};

const messageHandler = (data: any) => {
  const embedData = {
    type: "rich",
    title: `${data.criteria.data.token.name}`,
    description: "",
    color: 0xff008c,
    fields: [
      {
        name: `Listed for:`,
        value: ``,
      },
      {
        name: `${data.price.amount.native} ETH`,
        value: `$${numberWithCommas(Number(data.price.amount.usd.toFixed(2)))}`,
      },
    ],
    thumbnail: {
      url: `${data.criteria.data.token.image}`,
      height: 0,
      width: 0,
    },
    url: `https://sansa.xyz/asset/${BRAINDROPS_CONTRACT}/${data.criteria.data.token.tokenId}`,
  } as any;

  const componentData = {
    type: 1,
    components: [
      {
        style: 5,
        label: `Buy on Sansa`,
        disabled: false,
        type: 2,
        url: `https://sansa.xyz/asset/${BRAINDROPS_CONTRACT}/${data.criteria.data.token.tokenId}`,
      },
    ],
  };

  let listingsChannel = bot.channels.cache.get(
    LISTINGS_CHANNEL_ID
  ) as TextChannel;

  console.log("sending message...");
  listingsChannel.send({ embeds: [embedData], components: [componentData] });
};

const numberWithCommas = (x: number) => {
  if (!x) return "0";
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
