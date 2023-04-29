"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("redis");
const util = require("util");
const KEY = `account1/balance`;
const DEFAULT_BALANCE = 100;
const MAX_EXPIRATION = 60 * 60 * 24 * 30;
const UNIT_PRICE = 3;
exports.chargeRequestRedis = async function (input) {
    const redisClient = await getRedisClient();
    var remainingBalance = await getBalanceRedis(redisClient, KEY);
    console.log(remainingBalance + "iii");
    var charges = getCharges(input.unit);
    const isAuthorized = authorizeRequest(remainingBalance, charges);
    if (!isAuthorized) {
        return {
            remainingBalance,
            isAuthorized,
            charges: 0,
        };
    }
    var bal = await deduct(redisClient, remainingBalance, charges);
    
    await disconnectRedis(redisClient);
    return {
        bal,
        charges,
        isAuthorized,
    };
};
exports.resetRedis = async function () {
    const redisClient = await getRedisClient();
    const ret = new Promise((resolve, reject) => {
        redisClient.set(KEY, String(DEFAULT_BALANCE), (err, res) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(DEFAULT_BALANCE);
            }
        });
    });
    await disconnectRedis(redisClient);
    return ret;
};
async function getRedisClient() {
    return new Promise((resolve, reject) => {
        try {
            const client = new redis.RedisClient({
                host: process.env.ENDPOINT,
                port: parseInt(process.env.PORT || "6379"),
            });
            client.on("ready", () => {
                resolve(client);
            });
        }
        catch (error) {
            reject(error);
        }
    });
}
async function disconnectRedis(client) {
    return new Promise((resolve, reject) => {
        client.quit((error, res) => {
            if (error) {
                reject(error);
            }
            else if (res == "OK") {
                resolve(res);
            }
            else {
                reject("unknown error closing redis connection.");
            }
        });
    });
}
async function deduct(redisClient, remainingBalance, charges){
    var bal = new Promise((resolve, reject) => {
        redisClient.set(KEY, String(parseInt(remainingBalance) - charges), (err, res) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(parseInt(remainingBalance) - charges);
            }
        });
    });
    return bal;
}
function authorizeRequest(remainingBalance, charges) {
    return parseInt(remainingBalance) >= charges;
}
function getCharges(units) {
    return UNIT_PRICE * parseInt(units);
}
async function getBalanceRedis(redisClient, key) {
    const res = await util.promisify(redisClient.get).bind(redisClient).call(redisClient, key);
    return parseInt(res || "0");
}