"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../../utils/logger");
const request_1 = require("../../../utils/request");
const localQuestions_1 = require("../../../utils/localQuestions");
const localEvaluator_1 = require("../../../utils/localEvaluator");
const localHistory_1 = require("../../../utils/localHistory");
const soundManager_1 = require("../../../utils/soundManager");
// 炫酷的赛博全息小助手 SVG 系列
const AVATAR_SVGS = {
    idle: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='100%' height='100%'><rect x='5' y='0' width='1' height='1' fill='%23a855f7'/><rect x='6' y='0' width='1' height='1' fill='%23a855f7'/><rect x='7' y='0' width='1' height='1' fill='%23a855f7'/><rect x='8' y='0' width='1' height='1' fill='%23a855f7'/><rect x='9' y='0' width='1' height='1' fill='%23a855f7'/><rect x='4' y='1' width='1' height='1' fill='%23a855f7'/><rect x='5' y='1' width='1' height='1' fill='%23a855f7'/><rect x='6' y='1' width='1' height='1' fill='%23ffffff'/><rect x='7' y='1' width='1' height='1' fill='%23a855f7'/><rect x='8' y='1' width='1' height='1' fill='%23a855f7'/><rect x='9' y='1' width='1' height='1' fill='%23a855f7'/><rect x='10' y='1' width='1' height='1' fill='%23a855f7'/><rect x='3' y='2' width='1' height='1' fill='%23a855f7'/><rect x='4' y='2' width='1' height='1' fill='%23a855f7'/><rect x='5' y='2' width='1' height='1' fill='%23a855f7'/><rect x='6' y='2' width='1' height='1' fill='%23a855f7'/><rect x='7' y='2' width='1' height='1' fill='%23a855f7'/><rect x='8' y='2' width='1' height='1' fill='%23ffffff'/><rect x='9' y='2' width='1' height='1' fill='%23a855f7'/><rect x='10' y='2' width='1' height='1' fill='%23a855f7'/><rect x='11' y='2' width='1' height='1' fill='%23a855f7'/><rect x='3' y='3' width='1' height='1' fill='%2357371d'/><rect x='4' y='3' width='1' height='1' fill='%2357371d'/><rect x='5' y='3' width='1' height='1' fill='%2357371d'/><rect x='6' y='3' width='1' height='1' fill='%2357371d'/><rect x='7' y='3' width='1' height='1' fill='%2357371d'/><rect x='8' y='3' width='1' height='1' fill='%2357371d'/><rect x='9' y='3' width='1' height='1' fill='%2357371d'/><rect x='10' y='3' width='1' height='1' fill='%2357371d'/><rect x='11' y='3' width='1' height='1' fill='%2357371d'/><rect x='2' y='4' width='1' height='1' fill='%2357371d'/><rect x='3' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='4' width='1' height='1' fill='%2357371d'/><rect x='1' y='5' width='1' height='1' fill='%2357371d'/><rect x='2' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='5' width='1' height='1' fill='%2357371d'/><rect x='1' y='6' width='1' height='1' fill='%2357371d'/><rect x='2' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='6' width='1' height='1' fill='%2357371d'/><rect x='0' y='7' width='1' height='1' fill='%2357371d'/><rect x='1' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='7' width='1' height='1' fill='%2357371d'/><rect x='0' y='8' width='1' height='1' fill='%2357371d'/><rect x='1' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='8' width='1' height='1' fill='%233d2511'/><rect x='4' y='8' width='1' height='1' fill='%233d2511'/><rect x='5' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='8' width='1' height='1' fill='%233d2511'/><rect x='10' y='8' width='1' height='1' fill='%233d2511'/><rect x='11' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='8' width='1' height='1' fill='%2357371d'/><rect x='0' y='9' width='1' height='1' fill='%2357371d'/><rect x='1' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='9' width='1' height='1' fill='%23e74c3c'/><rect x='3' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='9' width='1' height='1' fill='%23e74c3c'/><rect x='12' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='9' width='1' height='1' fill='%2357371d'/><rect x='0' y='10' width='1' height='1' fill='%2357371d'/><rect x='1' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='10' width='1' height='1' fill='%233d2511'/><rect x='6' y='10' width='1' height='1' fill='%233d2511'/><rect x='7' y='10' width='1' height='1' fill='%233d2511'/><rect x='8' y='10' width='1' height='1' fill='%233d2511'/><rect x='9' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='10' width='1' height='1' fill='%2357371d'/><rect x='0' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='13' width='1' height='1' fill='%2357371d'/><rect x='3' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='13' width='1' height='1' fill='%2357371d'/><rect x='5' y='13' width='1' height='1' fill='%2357371d'/><rect x='6' y='13' width='1' height='1' fill='%2357371d'/><rect x='7' y='13' width='1' height='1' fill='%2357371d'/><rect x='8' y='13' width='1' height='1' fill='%2357371d'/><rect x='9' y='13' width='1' height='1' fill='%2357371d'/><rect x='10' y='13' width='1' height='1' fill='%2357371d'/><rect x='11' y='13' width='1' height='1' fill='%2357371d'/><rect x='12' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='14' width='1' height='1' fill='%2357371d'/><rect x='5' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='14' width='1' height='1' fill='%2357371d'/><rect x='4' y='15' width='1' height='1' fill='%2357371d'/><rect x='5' y='15' width='1' height='1' fill='%2357371d'/><rect x='6' y='15' width='1' height='1' fill='%2357371d'/><rect x='7' y='15' width='1' height='1' fill='%2357371d'/><rect x='8' y='15' width='1' height='1' fill='%2357371d'/><rect x='9' y='15' width='1' height='1' fill='%2357371d'/><rect x='10' y='15' width='1' height='1' fill='%2357371d'/></svg>`,
    thinking: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='100%' height='100%'><rect x='5' y='0' width='1' height='1' fill='%23a855f7'/><rect x='6' y='0' width='1' height='1' fill='%23a855f7'/><rect x='7' y='0' width='1' height='1' fill='%23a855f7'/><rect x='8' y='0' width='1' height='1' fill='%23a855f7'/><rect x='9' y='0' width='1' height='1' fill='%23a855f7'/><rect x='11' y='0' width='1' height='1' fill='%233498db'/><rect x='12' y='0' width='1' height='1' fill='%233498db'/><rect x='13' y='0' width='1' height='1' fill='%233498db'/><rect x='4' y='1' width='1' height='1' fill='%23a855f7'/><rect x='5' y='1' width='1' height='1' fill='%23a855f7'/><rect x='6' y='1' width='1' height='1' fill='%23ffffff'/><rect x='7' y='1' width='1' height='1' fill='%23a855f7'/><rect x='8' y='1' width='1' height='1' fill='%23a855f7'/><rect x='9' y='1' width='1' height='1' fill='%23a855f7'/><rect x='10' y='1' width='1' height='1' fill='%23a855f7'/><rect x='11' y='1' width='1' height='1' fill='%233498db'/><rect x='14' y='1' width='1' height='1' fill='%233498db'/><rect x='3' y='2' width='1' height='1' fill='%23a855f7'/><rect x='4' y='2' width='1' height='1' fill='%23a855f7'/><rect x='5' y='2' width='1' height='1' fill='%23a855f7'/><rect x='6' y='2' width='1' height='1' fill='%23a855f7'/><rect x='7' y='2' width='1' height='1' fill='%23a855f7'/><rect x='8' y='2' width='1' height='1' fill='%23ffffff'/><rect x='9' y='2' width='1' height='1' fill='%23a855f7'/><rect x='10' y='2' width='1' height='1' fill='%23a855f7'/><rect x='11' y='2' width='1' height='1' fill='%23a855f7'/><rect x='13' y='2' width='1' height='1' fill='%233498db'/><rect x='3' y='3' width='1' height='1' fill='%2357371d'/><rect x='4' y='3' width='1' height='1' fill='%2357371d'/><rect x='5' y='3' width='1' height='1' fill='%2357371d'/><rect x='6' y='3' width='1' height='1' fill='%2357371d'/><rect x='7' y='3' width='1' height='1' fill='%2357371d'/><rect x='8' y='3' width='1' height='1' fill='%2357371d'/><rect x='9' y='3' width='1' height='1' fill='%2357371d'/><rect x='10' y='3' width='1' height='1' fill='%2357371d'/><rect x='11' y='3' width='1' height='1' fill='%2357371d'/><rect x='13' y='3' width='1' height='1' fill='%233498db'/><rect x='2' y='4' width='1' height='1' fill='%2357371d'/><rect x='3' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='4' width='1' height='1' fill='%2357371d'/><rect x='1' y='5' width='1' height='1' fill='%2357371d'/><rect x='2' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='5' width='1' height='1' fill='%2357371d'/><rect x='14' y='5' width='1' height='1' fill='%233498db'/><rect x='1' y='6' width='1' height='1' fill='%2357371d'/><rect x='2' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='6' width='1' height='1' fill='%2357371d'/><rect x='0' y='7' width='1' height='1' fill='%2357371d'/><rect x='1' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='7' width='1' height='1' fill='%2357371d'/><rect x='0' y='8' width='1' height='1' fill='%2357371d'/><rect x='1' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='8' width='1' height='1' fill='%233d2511'/><rect x='3' y='8' width='1' height='1' fill='%233d2511'/><rect x='4' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='8' width='1' height='1' fill='%233d2511'/><rect x='9' y='8' width='1' height='1' fill='%233d2511'/><rect x='10' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='8' width='1' height='1' fill='%2357371d'/><rect x='0' y='9' width='1' height='1' fill='%2357371d'/><rect x='1' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='9' width='1' height='1' fill='%23e74c3c'/><rect x='3' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='9' width='1' height='1' fill='%23e74c3c'/><rect x='12' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='9' width='1' height='1' fill='%2357371d'/><rect x='0' y='10' width='1' height='1' fill='%2357371d'/><rect x='1' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='10' width='1' height='1' fill='%233d2511'/><rect x='4' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='10' width='1' height='1' fill='%2357371d'/><rect x='0' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='13' width='1' height='1' fill='%2357371d'/><rect x='3' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='13' width='1' height='1' fill='%2357371d'/><rect x='5' y='13' width='1' height='1' fill='%2357371d'/><rect x='6' y='13' width='1' height='1' fill='%2357371d'/><rect x='7' y='13' width='1' height='1' fill='%2357371d'/><rect x='8' y='13' width='1' height='1' fill='%2357371d'/><rect x='9' y='13' width='1' height='1' fill='%2357371d'/><rect x='10' y='13' width='1' height='1' fill='%2357371d'/><rect x='11' y='13' width='1' height='1' fill='%2357371d'/><rect x='12' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='14' width='1' height='1' fill='%2357371d'/><rect x='5' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='14' width='1' height='1' fill='%2357371d'/><rect x='4' y='15' width='1' height='1' fill='%2357371d'/><rect x='5' y='15' width='1' height='1' fill='%2357371d'/><rect x='6' y='15' width='1' height='1' fill='%2357371d'/><rect x='7' y='15' width='1' height='1' fill='%2357371d'/><rect x='8' y='15' width='1' height='1' fill='%2357371d'/><rect x='9' y='15' width='1' height='1' fill='%2357371d'/><rect x='10' y='15' width='1' height='1' fill='%2357371d'/></svg>`,
    surprised: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='100%' height='100%'><rect x='5' y='0' width='1' height='1' fill='%23a855f7'/><rect x='6' y='0' width='1' height='1' fill='%23a855f7'/><rect x='7' y='0' width='1' height='1' fill='%23a855f7'/><rect x='8' y='0' width='1' height='1' fill='%23a855f7'/><rect x='9' y='0' width='1' height='1' fill='%23a855f7'/><rect x='4' y='1' width='1' height='1' fill='%23a855f7'/><rect x='5' y='1' width='1' height='1' fill='%23a855f7'/><rect x='6' y='1' width='1' height='1' fill='%23ffffff'/><rect x='7' y='1' width='1' height='1' fill='%23a855f7'/><rect x='8' y='1' width='1' height='1' fill='%23a855f7'/><rect x='9' y='1' width='1' height='1' fill='%23a855f7'/><rect x='10' y='1' width='1' height='1' fill='%23a855f7'/><rect x='3' y='2' width='1' height='1' fill='%23a855f7'/><rect x='4' y='2' width='1' height='1' fill='%23a855f7'/><rect x='5' y='2' width='1' height='1' fill='%23a855f7'/><rect x='6' y='2' width='1' height='1' fill='%23a855f7'/><rect x='7' y='2' width='1' height='1' fill='%23a855f7'/><rect x='8' y='2' width='1' height='1' fill='%23ffffff'/><rect x='9' y='2' width='1' height='1' fill='%23a855f7'/><rect x='10' y='2' width='1' height='1' fill='%23a855f7'/><rect x='11' y='2' width='1' height='1' fill='%23a855f7'/><rect x='3' y='3' width='1' height='1' fill='%2357371d'/><rect x='4' y='3' width='1' height='1' fill='%2357371d'/><rect x='5' y='3' width='1' height='1' fill='%2357371d'/><rect x='6' y='3' width='1' height='1' fill='%2357371d'/><rect x='7' y='3' width='1' height='1' fill='%2357371d'/><rect x='8' y='3' width='1' height='1' fill='%2357371d'/><rect x='9' y='3' width='1' height='1' fill='%2357371d'/><rect x='10' y='3' width='1' height='1' fill='%2357371d'/><rect x='11' y='3' width='1' height='1' fill='%2357371d'/><rect x='2' y='4' width='1' height='1' fill='%2357371d'/><rect x='3' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='4' width='1' height='1' fill='%2357371d'/><rect x='1' y='5' width='1' height='1' fill='%2357371d'/><rect x='2' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='5' width='1' height='1' fill='%2357371d'/><rect x='1' y='6' width='1' height='1' fill='%2357371d'/><rect x='2' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='6' width='1' height='1' fill='%2357371d'/><rect x='0' y='7' width='1' height='1' fill='%2357371d'/><rect x='1' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='7' width='1' height='1' fill='%2357371d'/><rect x='0' y='8' width='1' height='1' fill='%2357371d'/><rect x='1' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='8' width='1' height='1' fill='%233d2511'/><rect x='3' y='8' width='1' height='1' fill='%233d2511'/><rect x='4' y='8' width='1' height='1' fill='%233d2511'/><rect x='5' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='8' width='1' height='1' fill='%233d2511'/><rect x='9' y='8' width='1' height='1' fill='%233d2511'/><rect x='10' y='8' width='1' height='1' fill='%233d2511'/><rect x='11' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='8' width='1' height='1' fill='%2357371d'/><rect x='0' y='9' width='1' height='1' fill='%2357371d'/><rect x='1' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='9' width='1' height='1' fill='%233d2511'/><rect x='3' y='9' width='1' height='1' fill='%233d2511'/><rect x='4' y='9' width='1' height='1' fill='%233d2511'/><rect x='5' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='9' width='1' height='1' fill='%233d2511'/><rect x='9' y='9' width='1' height='1' fill='%233d2511'/><rect x='10' y='9' width='1' height='1' fill='%233d2511'/><rect x='11' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='9' width='1' height='1' fill='%2357371d'/><rect x='0' y='10' width='1' height='1' fill='%2357371d'/><rect x='1' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='10' width='1' height='1' fill='%233d2511'/><rect x='6' y='10' width='1' height='1' fill='%233d2511'/><rect x='7' y='10' width='1' height='1' fill='%233d2511'/><rect x='8' y='10' width='1' height='1' fill='%233d2511'/><rect x='9' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='10' width='1' height='1' fill='%2357371d'/><rect x='0' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='11' width='1' height='1' fill='%233d2511'/><rect x='6' y='11' width='1' height='1' fill='%233d2511'/><rect x='7' y='11' width='1' height='1' fill='%233d2511'/><rect x='8' y='11' width='1' height='1' fill='%233d2511'/><rect x='9' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='13' width='1' height='1' fill='%2357371d'/><rect x='3' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='13' width='1' height='1' fill='%2357371d'/><rect x='5' y='13' width='1' height='1' fill='%2357371d'/><rect x='6' y='13' width='1' height='1' fill='%2357371d'/><rect x='7' y='13' width='1' height='1' fill='%2357371d'/><rect x='8' y='13' width='1' height='1' fill='%2357371d'/><rect x='9' y='13' width='1' height='1' fill='%2357371d'/><rect x='10' y='13' width='1' height='1' fill='%2357371d'/><rect x='11' y='13' width='1' height='1' fill='%2357371d'/><rect x='12' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='14' width='1' height='1' fill='%2357371d'/><rect x='5' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='14' width='1' height='1' fill='%2357371d'/><rect x='4' y='15' width='1' height='1' fill='%2357371d'/><rect x='5' y='15' width='1' height='1' fill='%2357371d'/><rect x='6' y='15' width='1' height='1' fill='%2357371d'/><rect x='7' y='15' width='1' height='1' fill='%2357371d'/><rect x='8' y='15' width='1' height='1' fill='%2357371d'/><rect x='9' y='15' width='1' height='1' fill='%2357371d'/><rect x='10' y='15' width='1' height='1' fill='%2357371d'/></svg>`,
    happy: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='100%' height='100%'><rect x='5' y='0' width='1' height='1' fill='%23a855f7'/><rect x='6' y='0' width='1' height='1' fill='%23a855f7'/><rect x='7' y='0' width='1' height='1' fill='%23a855f7'/><rect x='8' y='0' width='1' height='1' fill='%23a855f7'/><rect x='9' y='0' width='1' height='1' fill='%23a855f7'/><rect x='4' y='1' width='1' height='1' fill='%23a855f7'/><rect x='5' y='1' width='1' height='1' fill='%23a855f7'/><rect x='6' y='1' width='1' height='1' fill='%23ffffff'/><rect x='7' y='1' width='1' height='1' fill='%23a855f7'/><rect x='8' y='1' width='1' height='1' fill='%23a855f7'/><rect x='9' y='1' width='1' height='1' fill='%23a855f7'/><rect x='10' y='1' width='1' height='1' fill='%23a855f7'/><rect x='3' y='2' width='1' height='1' fill='%23a855f7'/><rect x='4' y='2' width='1' height='1' fill='%23a855f7'/><rect x='5' y='2' width='1' height='1' fill='%23a855f7'/><rect x='6' y='2' width='1' height='1' fill='%23a855f7'/><rect x='7' y='2' width='1' height='1' fill='%23a855f7'/><rect x='8' y='2' width='1' height='1' fill='%23ffffff'/><rect x='9' y='2' width='1' height='1' fill='%23a855f7'/><rect x='10' y='2' width='1' height='1' fill='%23a855f7'/><rect x='11' y='2' width='1' height='1' fill='%23a855f7'/><rect x='3' y='3' width='1' height='1' fill='%2357371d'/><rect x='4' y='3' width='1' height='1' fill='%2357371d'/><rect x='5' y='3' width='1' height='1' fill='%2357371d'/><rect x='6' y='3' width='1' height='1' fill='%2357371d'/><rect x='7' y='3' width='1' height='1' fill='%2357371d'/><rect x='8' y='3' width='1' height='1' fill='%2357371d'/><rect x='9' y='3' width='1' height='1' fill='%2357371d'/><rect x='10' y='3' width='1' height='1' fill='%2357371d'/><rect x='11' y='3' width='1' height='1' fill='%2357371d'/><rect x='2' y='4' width='1' height='1' fill='%2357371d'/><rect x='3' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='4' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='4' width='1' height='1' fill='%2357371d'/><rect x='1' y='5' width='1' height='1' fill='%2357371d'/><rect x='2' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='4' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='5' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='6' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='7' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='8' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='9' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='10' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='11' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='12' y='5' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='5' width='1' height='1' fill='%2357371d'/><rect x='1' y='6' width='1' height='1' fill='%2357371d'/><rect x='2' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='3' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='6' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='6' width='1' height='1' fill='%23d39c3f'/><rect x='13' y='6' width='1' height='1' fill='%2357371d'/><rect x='0' y='7' width='1' height='1' fill='%2357371d'/><rect x='1' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='7' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='7' width='1' height='1' fill='%2357371d'/><rect x='0' y='8' width='1' height='1' fill='%2357371d'/><rect x='1' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='8' width='1' height='1' fill='%233d2511'/><rect x='4' y='8' width='1' height='1' fill='%233d2511'/><rect x='5' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='8' width='1' height='1' fill='%233d2511'/><rect x='10' y='8' width='1' height='1' fill='%233d2511'/><rect x='11' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='8' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='8' width='1' height='1' fill='%2357371d'/><rect x='0' y='9' width='1' height='1' fill='%2357371d'/><rect x='1' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='9' width='1' height='1' fill='%23e74c3c'/><rect x='3' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='9' width='1' height='1' fill='%23e74c3c'/><rect x='12' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='9' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='9' width='1' height='1' fill='%2357371d'/><rect x='0' y='10' width='1' height='1' fill='%2357371d'/><rect x='1' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='10' width='1' height='1' fill='%233d2511'/><rect x='10' y='10' width='1' height='1' fill='%233d2511'/><rect x='11' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='10' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='10' width='1' height='1' fill='%2357371d'/><rect x='0' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='2' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='11' width='1' height='1' fill='%233d2511'/><rect x='5' y='11' width='1' height='1' fill='%233d2511'/><rect x='6' y='11' width='1' height='1' fill='%233d2511'/><rect x='7' y='11' width='1' height='1' fill='%233d2511'/><rect x='8' y='11' width='1' height='1' fill='%233d2511'/><rect x='9' y='11' width='1' height='1' fill='%233d2511'/><rect x='10' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='11' width='1' height='1' fill='%23f5e3ca'/><rect x='14' y='11' width='1' height='1' fill='%2357371d'/><rect x='1' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='3' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='4' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='5' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='11' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='12' y='12' width='1' height='1' fill='%23f5e3ca'/><rect x='13' y='12' width='1' height='1' fill='%2357371d'/><rect x='2' y='13' width='1' height='1' fill='%2357371d'/><rect x='3' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='13' width='1' height='1' fill='%2357371d'/><rect x='5' y='13' width='1' height='1' fill='%2357371d'/><rect x='6' y='13' width='1' height='1' fill='%2357371d'/><rect x='7' y='13' width='1' height='1' fill='%2357371d'/><rect x='8' y='13' width='1' height='1' fill='%2357371d'/><rect x='9' y='13' width='1' height='1' fill='%2357371d'/><rect x='10' y='13' width='1' height='1' fill='%2357371d'/><rect x='11' y='13' width='1' height='1' fill='%2357371d'/><rect x='12' y='13' width='1' height='1' fill='%2357371d'/><rect x='4' y='14' width='1' height='1' fill='%2357371d'/><rect x='5' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='6' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='7' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='8' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='9' y='14' width='1' height='1' fill='%23f5e3ca'/><rect x='10' y='14' width='1' height='1' fill='%2357371d'/><rect x='4' y='15' width='1' height='1' fill='%2357371d'/><rect x='5' y='15' width='1' height='1' fill='%2357371d'/><rect x='6' y='15' width='1' height='1' fill='%2357371d'/><rect x='7' y='15' width='1' height='1' fill='%2357371d'/><rect x='8' y='15' width='1' height='1' fill='%2357371d'/><rect x='9' y='15' width='1' height='1' fill='%2357371d'/><rect x='10' y='15' width='1' height='1' fill='%2357371d'/></svg>`
};
const SESSION_PREFIX = 'test_session_';
// 用于管理页面私有变量，实现完美的内存管理和物理隔离
const privateStore = new WeakMap();
function getPrivate(instance) {
    let store = privateStore.get(instance);
    if (!store) {
        store = { confirmCallback: null, cancelCallback: null, typingTimer: null };
        privateStore.set(instance, store);
    }
    return store;
}
Page({
    data: {
        testId: '',
        questions: [],
        currentIndex: 0,
        answers: [],
        selectedOptionId: '',
        progress: 0,
        submitting: false, // 防重复提交状态锁
        // AVG 游戏化交互状态
        displayText: '',
        isTyping: false,
        characterExpression: 'idle',
        avatarSvg: '',
        // 自定义赛博弹窗状态
        showCyberModal: false,
        modalTitle: '',
        modalContent: '',
        modalShowCancel: true,
        modalConfirmText: '确定',
        modalCancelText: '取消',
        modalIsDanger: false,
        modalIsLoading: false
    },
    onLoad(options) {
        const testId = options.testId || 'mbti_12';
        this.setData({ testId });
        logger_1.Logger.info(`进入答题页, testId: ${testId}`);
        // 1. 加载题目配置
        this.loadQuestions(testId);
    },
    /**
     * 加载题库（具备在线/离线双模态）
     */
    loadQuestions(testId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const app = getApp();
            // 如果全局标为离线，直接使用本地静态题库
            if (app.globalData.isOfflineMode) {
                logger_1.Logger.warn('[Test] 当前处于离线降级模式，加载本地备份题库。');
                this.initQuestions(localQuestions_1.localMbtiQuestions);
                return;
            }
            try {
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/stages/fun_lobby/npcs/${testId}/questions`,
                    method: 'GET'
                });
                if (res.code === 0 && ((_a = res.data) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    this.initQuestions(res.data);
                }
                else {
                    throw new Error('下发题库为空或返回不合规');
                }
            }
            catch (err) {
                logger_1.Logger.error('[Test] 从服务器加载题目异常，启用离线静态题库兜底: ', err);
                this.initQuestions(localQuestions_1.localMbtiQuestions);
            }
        });
    },
    /**
     * 初始化题库数据并检查是否有断点未完成的测评
     */
    initQuestions(questions) {
        var _a;
        this.setData({ questions });
        this.updateProgress();
        // 检测本地是否有未完成的答题会话，若有提示恢复
        const sessionKey = `${SESSION_PREFIX}${this.data.testId}`;
        try {
            const cachedSession = wx.getStorageSync(sessionKey);
            if (cachedSession && ((_a = cachedSession.answers) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                this.showCyberModal({
                    title: '继续未完成的测评',
                    content: '系统检测到您有上次未完成的答题进度，是否继续答题？',
                    confirmText: '继续答题',
                    cancelText: '重新开始',
                    confirm: () => {
                        var _a;
                        logger_1.Logger.info('[Session] 恢复上次未完成 of 测评进度');
                        this.setData({
                            answers: cachedSession.answers,
                            currentIndex: cachedSession.currentIndex,
                            selectedOptionId: ((_a = cachedSession.answers[cachedSession.currentIndex]) === null || _a === void 0 ? void 0 : _a.selectedOptionId) || ''
                        });
                        this.updateProgress();
                        this.startTypingForCurrentQuestion();
                    },
                    cancel: () => {
                        logger_1.Logger.info('[Session] 放弃旧测评，重新开始答题');
                        wx.removeStorageSync(sessionKey);
                        this.startTypingForCurrentQuestion();
                    }
                });
            }
            else {
                this.startTypingForCurrentQuestion();
            }
        }
        catch (e) {
            logger_1.Logger.error('[Session] 读取答题缓存状态失败，执行默认触发:', e);
            this.startTypingForCurrentQuestion();
        }
    },
    /**
     * 进度条比例计算更新
     */
    updateProgress() {
        const total = this.data.questions.length;
        if (total === 0)
            return;
        const progress = Math.round((this.data.currentIndex / total) * 100);
        this.setData({ progress });
    },
    /**
     * 点击选项：记录答案并前进一步
     */
    onSelectOption(e) {
        if (this.data.submitting)
            return;
        // 核心交互防御：打字中点击任何选项，直接跳过打字，呈现完整题目，而不做选择
        if (this.data.isTyping) {
            this.completeTypingImmediate();
            return;
        }
        const selectedOptionId = e.currentTarget.dataset.id;
        const { currentIndex, questions, answers, testId } = this.data;
        const currentQuestion = questions[currentIndex];
        logger_1.Logger.info(`答题: 第 ${currentIndex + 1} 题, 题号: ${currentQuestion.id}, 选中选项: ${selectedOptionId}`);
        soundManager_1.SoundManager.play('select');
        // 1. 记录或覆盖答案
        const newAnswers = [...answers];
        newAnswers[currentIndex] = {
            questionId: currentQuestion.id,
            selectedOptionId: selectedOptionId
        };
        this.setData({
            selectedOptionId,
            answers: newAnswers
        });
        // 2. 异步缓存当前临时会话，以防中途退出
        const sessionKey = `${SESSION_PREFIX}${testId}`;
        wx.setStorage({
            key: sessionKey,
            data: {
                answers: newAnswers,
                currentIndex: currentIndex
            }
        });
        // 3. 延时跳转，提供点击的动效感知 (150ms)
        setTimeout(() => {
            var _a;
            if (currentIndex < questions.length - 1) {
                // 进入下一题
                const nextIndex = currentIndex + 1;
                this.setData({
                    currentIndex: nextIndex,
                    selectedOptionId: ((_a = newAnswers[nextIndex]) === null || _a === void 0 ? void 0 : _a.selectedOptionId) || ''
                });
                this.updateProgress();
                this.startTypingForCurrentQuestion();
            }
            else {
                // 已经是最后一题，开始提交并运算
                this.submitAssessment();
            }
        }, 150);
    },
    /**
     * 显示自定义赛博弹窗
     */
    showCyberModal(options) {
        const store = getPrivate(this);
        store.confirmCallback = options.confirm || null;
        store.cancelCallback = options.cancel || null;
        this.setData({
            showCyberModal: true,
            modalTitle: options.title,
            modalContent: options.content,
            modalShowCancel: options.showCancel !== false,
            modalConfirmText: options.confirmText || '确定',
            modalCancelText: options.cancelText || '取消',
            modalIsDanger: !!options.isDanger,
            modalIsLoading: !!options.isLoading
        });
    },
    /**
     * 弹窗确认事件
     */
    onCyberModalConfirm() {
        this.setData({ showCyberModal: false });
        const store = getPrivate(this);
        if (store.confirmCallback) {
            store.confirmCallback();
            store.confirmCallback = null;
        }
    },
    /**
     * 弹窗取消事件
     */
    onCyberModalCancel() {
        this.setData({ showCyberModal: false });
        const store = getPrivate(this);
        if (store.cancelCallback) {
            store.cancelCallback();
            store.cancelCallback = null;
        }
    },
    /**
     * 阻止弹窗滑动手势穿透
     */
    preventTouchMove() {
        // 阻止页面滚动穿透
    },
    /**
     * 撤销答题：返回上一题
     */
    onPrevQuestion() {
        var _a;
        if (this.data.submitting)
            return;
        const { currentIndex, answers } = this.data;
        if (currentIndex === 0)
            return;
        const prevIndex = currentIndex - 1;
        logger_1.Logger.info(`返回上一题: 第 ${prevIndex + 1} 题`);
        this.setData({
            currentIndex: prevIndex,
            selectedOptionId: ((_a = answers[prevIndex]) === null || _a === void 0 ? void 0 : _a.selectedOptionId) || ''
        });
        this.updateProgress();
        this.startTypingForCurrentQuestion();
    },
    /**
     * 退出答题流程
     */
    onExitTest() {
        if (this.data.submitting)
            return;
        this.showCyberModal({
            title: '放弃本次测评',
            content: '确定要退出测试吗？系统将保留您的答题进度，以便下次继续。',
            confirmText: '确定退出',
            cancelText: '继续测评',
            confirm: () => {
                logger_1.Logger.info('用户主动中断并退出测评页面');
                wx.navigateBack({
                    delta: 1
                });
            }
        });
    },
    /**
     * 提交数据运算（带在线提交与本地离线计算闭环分发）
     */
    submitAssessment() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data.submitting)
                return;
            this.setData({ submitting: true });
            const { testId, answers } = this.data;
            const sessionKey = `${SESSION_PREFIX}${testId}`;
            const app = getApp();
            this.showCyberModal({
                title: 'AI 深度分析中',
                content: '正在通过边缘算力分析人格特质...',
                showCancel: false,
                isLoading: true
            });
            // 1. 若全局标记为离线，直接走本地计算
            if (app.globalData.isOfflineMode) {
                logger_1.Logger.warn('[Submit] 离线模式：在微信端执行本地计分计算');
                this.evaluateLocally();
                return;
            }
            // 2. 在线提交
            try {
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/calculate`,
                    method: 'POST',
                    data: { testId, answers }
                });
                this.setData({ showCyberModal: false });
                if (res.code === 0) {
                    logger_1.Logger.info('[Submit] 测评报告在线计算入库成功');
                    // 清理当前草稿会话
                    wx.removeStorageSync(sessionKey);
                    // 直接携带结果数据跳转到报告页渲染
                    wx.redirectTo({
                        url: `/packageQuiz/pages/result/result?result=${encodeURIComponent(JSON.stringify(res.data))}`
                    });
                }
                else {
                    throw new Error(res.message);
                }
            }
            catch (err) {
                logger_1.Logger.error('[Submit] 在线提交接口异常，强制启用本地计分引擎降级:', err);
                // 在线提交遇到网络故障等情况，强制降级为本地离线处理
                this.evaluateLocally();
            }
        });
    },
    /**
     * 前端本地计算并保存历史记录
     */
    evaluateLocally() {
        const { testId, answers } = this.data;
        const sessionKey = `${SESSION_PREFIX}${testId}`;
        try {
            // 调用本地计分引擎计算 MBTI 结果
            const localResult = (0, localEvaluator_1.calculateLocalMBTI)(answers);
            // 提取原始得分快照
            const rawScores = {};
            localResult.dimensions.forEach(d => {
                rawScores[d.left] = d.leftScore;
                rawScores[d.right] = d.rightScore;
            });
            // 保存到 LocalStorage 模拟云端入库
            localHistory_1.LocalHistoryService.saveHistory({
                historyId: `local_hist_${Date.now()}`,
                testId: testId,
                testTitle: 'MBTI 16型人格专业测试',
                testType: 'MBTI',
                timestamp: Date.now(),
                resultCode: localResult.code,
                resultName: localResult.name,
                rawScores
            });
            this.setData({ showCyberModal: false });
            wx.removeStorageSync(sessionKey);
            // 跳转到结果页渲染
            wx.redirectTo({
                url: `/packageQuiz/pages/result/result?result=${encodeURIComponent(JSON.stringify(localResult))}`
            });
        }
        catch (evalErr) {
            this.setData({ showCyberModal: false });
            this.setData({ submitting: false });
            logger_1.Logger.error('[LocalEval] 本地计分计算发生崩溃故障:', evalErr);
            wx.showToast({
                title: '计算故障，请重新测试',
                icon: 'none'
            });
        }
    },
    /**
     * 启动当前题目的打字机动效
     */
    startTypingForCurrentQuestion() {
        const { currentIndex, questions } = this.data;
        const currentQuestion = questions[currentIndex];
        if (!currentQuestion)
            return;
        // 1. 更新全息立绘表情
        this.updateAvatarExpression(currentIndex);
        // 2. 清除上一次的定时器
        const store = getPrivate(this);
        if (store.typingTimer) {
            clearInterval(store.typingTimer);
            store.typingTimer = null;
        }
        this.setData({
            displayText: '',
            isTyping: true
        });
        let currentLen = 0;
        const text = currentQuestion.text;
        const speed = 35; // 毫秒/字
        // 3. 开启打字机循环
        store.typingTimer = setInterval(() => {
            currentLen++;
            if (currentLen <= text.length) {
                this.setData({
                    displayText: text.slice(0, currentLen)
                });
            }
            else {
                clearInterval(store.typingTimer);
                store.typingTimer = null;
                this.setData({
                    isTyping: false
                });
            }
        }, speed);
    },
    /**
     * 立即完成打字（跳过动效）
     */
    completeTypingImmediate() {
        const { currentIndex, questions } = this.data;
        const currentQuestion = questions[currentIndex];
        if (!currentQuestion)
            return;
        const store = getPrivate(this);
        if (store.typingTimer) {
            clearInterval(store.typingTimer);
            store.typingTimer = null;
        }
        this.setData({
            displayText: currentQuestion.text,
            isTyping: false
        });
    },
    /**
     * 更新 AI 引导姬的全息立绘表情
     */
    updateAvatarExpression(index) {
        const { questions } = this.data;
        const currentQuestion = questions[index];
        let expression = 'idle';
        if (currentQuestion) {
            if (currentQuestion.expression) {
                expression = currentQuestion.expression;
            }
            else {
                // 启发式逻辑：最后一题展示笑脸，超过 15 字展现思考，其余默认
                if (index === questions.length - 1) {
                    expression = 'happy';
                }
                else if (currentQuestion.text.length > 15) {
                    expression = 'thinking';
                }
            }
        }
        this.setData({
            characterExpression: expression,
            avatarSvg: AVATAR_SVGS[expression] || AVATAR_SVGS.idle
        });
    },
    /**
     * 点击对话气泡时的处理
     */
    onTapDialogue() {
        if (this.data.isTyping) {
            this.completeTypingImmediate();
        }
    },
    /**
     * 页面卸载生命周期防守，避免定时器句柄残留泄漏
     */
    onUnload() {
        const store = getPrivate(this);
        if (store.typingTimer) {
            clearInterval(store.typingTimer);
            store.typingTimer = null;
        }
        privateStore.delete(this);
        logger_1.Logger.info('测评页面卸载，已清理打字机句柄并释放私有变量引用');
    }
});
