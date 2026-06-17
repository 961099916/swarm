INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_convert_json', 'JSON 格式化 - 还在为一团乱麻的 JSON 字符串头疼吗？这个接口能瞬间让它变得井井有条，赏心悦目。

## 功能概述
你只需要提供一个原始的、可能是压缩过的或者格式混乱的 JSON 字符串，这个 API 就会返回一个经过美化（带标准缩进和换行）的版本。这在调试 API 响应、或者需要在前端界面清晰展示 JSON 数据时非常有用。

## 使用须知
> [!NOTE]
> **请求格式**
> 请注意，待格式化的 JSON 字符串需要被包裹在另一个 JSON 对象中，作为 `content` 字段的值提交。具体格式请参考请求体示例。

## 错误处理指南
- **400 Bad Request**: 最常见的原因是你提供的 `content` 字符串本身不是一个有效的 JSON。请仔细检查括号、引号是否正确闭合，或者有没有多余的逗号等语法错误。', 'general', 'https://uapis.cn/api/v1/convert/json', 'POST', '{}', '{"content":"{{content}}"}', NULL, '[{"name":"content","type":"string","required":true,"description":"需要被格式化的原始JSON字符串。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_convert_unixtime', '时间戳转换 - 时间戳和日期字符串，哪个用着更顺手？别纠结了，这个接口让你轻松拥有两种格式！

## 功能概述
这是一个非常智能的转换器。你给它一个 Unix 时间戳，它还你一个人类可读的日期时间；你给它一个日期时间字符串，它还你一个 Unix 时间戳。它会自动识别你输入的是哪种格式。

## 使用须知
这个接口非常智能，能够自动识别输入格式：

- **输入时间戳**：支持10位秒级（如 `1672531200`）和13位毫秒级（如 `1672531200000`）。
- **输入日期字符串**：为了确保准确性，推荐使用 `YYYY-MM-DD HH:mm:ss` 标准格式（如 `2023-01-01 08:00:00`）。

> [!TIP]
> 无论你输入哪种格式，响应中都会同时包含标准日期字符串和秒级Unix时间戳，方便你按需取用。

## 错误处理指南
- **400 Bad Request**: 如果你提供的 `time` 参数既不是有效的时间戳，也不是我们支持的日期格式，就会收到这个错误。请检查你的输入值。', 'general', 'https://uapis.cn/api/v1/convert/unixtime?time={{time}}', 'GET', '{}', NULL, NULL, '[{"name":"time","type":"string","required":true,"description":"一个智能时间参数，可传入Unix时间戳（10位或13位）或标准日期字符串（如 ''''2023-10-27 10:30:00''''），系统将自动识别并转换。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_daily_news_image', '每日新闻图 - 想用一张图快速了解天下大事？这个接口为你一键生成今日新闻摘要，非常适合用在早报、数字看板或应用首页等场景。

## 功能概述
此接口会实时抓取各大平台的热点新闻，并动态地将它们渲染成一张清晰、美观的摘要图片。你调用接口，直接就能得到一张可以展示的图片。

## 使用须知
调用此接口时，请务必注意以下两点：

1.  **响应格式是图片**：接口成功时直接返回 `image/jpeg` 格式的二进制数据，而非 JSON。请确保你的客户端能正确处理二进制流，例如直接在 `<img>` 标签中显示，或保存为 `.jpg` 文件。

2.  **设置合理超时**：由于涉及实时新闻抓取和图片渲染，处理过程可能耗时数秒。建议将客户端请求超时时间设置为至少10秒，以防止因等待过久而失败。

> [!IMPORTANT]
> 未能正确处理图片响应或超时设置过短，是导致调用失败的最常见原因。', 'general', 'https://uapis.cn/api/v1/daily/news-image', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_daily_word', '每日单词 - 想给你的学习打卡、英语小组件或机器人推送加一个『每日单词』？这个接口每天给你一个稳定的单词，同一天多次请求结果一致。

## 功能概述
默认返回 1 个英文单词，支持按词库范围筛选，可选择是否附带例句和音标。也可以用 `count` 一次返回多个词，用于词汇复习列表。

## 词库选项
- `all`：全部英文词库，适合通用每日推荐。
- `cet4`：大学英语四级词汇，适合基础复习。
- `cet6`：大学英语六级词汇，适合进阶复习。
- `ielts`：雅思词汇，适合留学考试准备。
- `toefl`：托福词汇，适合北美考试准备。
- `gre`：GRE 词汇，适合高阶词汇训练。

## 使用须知
> [!IMPORTANT]
> `date` 与 `seed` 用于复现某一天或某个固定的取词结果，二者不能同时传入。', 'general', 'https://uapis.cn/api/v1/daily/word?lang={{lang}}&category={{category}}&count={{count}}&date={{date}}&seed={{seed}}&example={{example}}&phonetic={{phonetic}}', 'GET', '{}', NULL, NULL, '[{"name":"lang","type":"string","required":false,"description":"语种，目前支持 en，默认 en。"},{"name":"category","type":"string","required":false,"description":"词库范围：all/cet4/cet6/ielts/toefl/gre，默认 all。"},{"name":"count","type":"number","required":false,"description":"返回数量，1-20，默认 1。"},{"name":"date","type":"string","required":false,"description":"日期，格式 YYYY-MM-DD，作为每日单词的种子基准。"},{"name":"seed","type":"number","required":false,"description":"固定种子，结果可复现；不可与 date 同时使用。"},{"name":"example","type":"boolean","required":false,"description":"是否返回例句，默认 true。"},{"name":"phonetic","type":"boolean","required":false,"description":"是否返回音标，默认 true。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_minecraft_historyid', '查询 MC 曾用名 - 想知道某个大佬以前叫什么名字吗？这个接口可以帮你追溯一个 Minecraft 玩家的“黑历史”！

## 功能概述
通过提供玩家的用户名或 UUID，你可以获取到该玩家所有曾用名及其变更时间的列表。这对于识别回归的老玩家或者社区管理非常有用。

## 使用须知
> [!NOTE]
> **参数说明**
> - `name` 和 `uuid` 二选一
> - UUID 支持带连字符（如 `ee9b4ed1-aac1-491e-b761-1471be374b80`）或不带连字符格式

> [!IMPORTANT]
> **响应结构差异**
> - 使用 `uuid` 查询：返回单个用户的历史记录
> - 使用 `name` 查询：返回所有匹配用户的列表（包括当前用户名或曾用名匹配的玩家），需判断响应中是否有 `results` 字段来区分两种模式', 'general', 'https://uapis.cn/api/v1/game/minecraft/historyid?name={{name}}&uuid={{uuid}}', 'GET', '{}', NULL, NULL, '[{"name":"name","type":"string","required":false,"description":"玩家的 Minecraft 用户名。使用此参数查询时，会返回所有匹配用户的列表（包括当前用户名或曾用名匹配的玩家）。"},{"name":"uuid","type":"string","required":false,"description":"玩家的 Minecraft UUID，支持带连字符或不带连字符格式。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_minecraft_serverstatus', '查询 MC 服务器 - 想在加入服务器前看看有多少人在线？或者检查一下服务器开没开？用这个接口就对了！

## 功能概述
你可以通过提供服务器地址（域名或IP），来获取一个 Minecraft Java 版服务器的实时状态。返回信息包括服务器是否在线、当前玩家数、最大玩家数、服务器版本、MOTD（每日消息）以及服务器图标等。

如果服务器返回当前在线玩家列表，响应里还会带上 `online_players` 字段。这个字段可能省略，部分服务器返回的列表也可能不完整。', 'general', 'https://uapis.cn/api/v1/game/minecraft/serverstatus?server={{server}}', 'GET', '{}', NULL, NULL, '[{"name":"server","type":"string","required":true,"description":"Minecraft服务器的地址，可以是域名（如 `hypixel.net`）或 `IP:端口` 的形式（如 `mc.example.com:25565`）。如果省略端口，将默认使用 `25565`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_minecraft_userinfo', '查询 MC 玩家 - 只需要一个玩家的用户名，就能快速获取到他的正版皮肤和独一无二的UUID！

## 功能概述
这是一个基础但非常实用的接口。通过玩家当前的游戏内名称（Username），你可以查询到他对应的UUID（唯一标识符）和当前皮肤的URL地址。这是构建许多其他玩家相关服务的第一步。', 'general', 'https://uapis.cn/api/v1/game/minecraft/userinfo?username={{username}}', 'GET', '{}', NULL, NULL, '[{"name":"username","type":"string","required":true,"description":"玩家的 Minecraft 游戏内名称（正版ID）。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_steam_summary', '查询 Steam 用户 - 想在你的网站或应用中展示用户的 Steam 个人资料？这个接口就是为你准备的。

## 功能概述
通过一个用户的 Steam 标识（支持多种格式），你可以获取到他公开的个人资料摘要，包括昵称、头像、在线状态、真实姓名（如果公开）和个人资料主页URL等信息。

## 支持的参数格式
接口现在支持以下几种标识符格式：
- **`steamid`**: 64位SteamID（如 `76561197960287930`）
- **`id`**: 自定义URL名称（如 `gabelogannewell`）
- **`id3`**: Steam ID3格式（如 `STEAM_0:0:22202`）
- 完整的个人资料链接
- 好友代码

## 使用须知

> [!IMPORTANT]
> **访问凭证说明**
> 这个接口可以传 `key` 使用您自己的访问凭证。如果您选择传入，请注意妥善保管，不要把它写进公开的前端代码中。

在处理响应时，请注意以下数字代码的含义：
- **`personastate` (用户状态)**: 0-离线, 1-在线, 2-忙碌, 3-离开, 4-打盹, 5-想交易, 6-想玩。
- **`communityvisibilitystate` (社区可见性)**: 1-私密, 3-公开 (API通常只能查到这两种状态)。', 'general', 'https://uapis.cn/api/v1/game/steam/summary?steamid={{steamid}}&id={{id}}&id3={{id3}}&key={{key}}', 'GET', '{}', NULL, NULL, '[{"name":"steamid","type":"string","required":false,"description":"用户的 Steam 标识。可以是以下任意一种格式：\n- 纯数字的 **SteamID64**\n- 用户的 **自定义 URL 名称** (Vanity URL)\n- 完整的 **个人资料链接** (包含 SteamID64 或自定义名称)\n- 好友代码 (如 `22202`)"},{"name":"id","type":"string","required":false,"description":"用户的 Steam 自定义URL名称（Vanity URL）。例如个人资料链接中 `/id/` 后面的部分。"},{"name":"id3","type":"string","required":false,"description":"用户的 Steam ID3 格式标识符。传统的 Steam ID 格式，形如 STEAM_X:Y:Z。"},{"name":"key","type":"string","required":false,"description":"这个接口可以传的访问凭证。此参数选填，如果传入，将优先使用您提供的值。请注意妥善保管，不要把它写进公开的前端代码中。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_epic_free', 'Epic 免费游戏 - 白嫖党的福音来了！想第一时间知道Epic商店本周送了哪些游戏大作吗？

## 功能概述
这个接口帮你实时追踪Epic Games商店的每周免费游戏活动。无需任何参数，调用后即可获得当前所有免费游戏的完整信息，包括游戏封面、原价、剩余时间等，再也不用担心错过心仪的免费游戏了！

## 使用场景
- 开发游戏资讯应用或网站
- 制作Epic免费游戏推送机器人
- 为用户提供游戏收藏建议
- 构建个人游戏库管理工具

> [!TIP]
> **关于时间格式**
> 为了方便不同场景的使用，我们同时提供了可读的时间字符串（如 `2025/01/10 00:00:00`）和13位毫秒时间戳。前端显示用字符串，程序逻辑用时间戳', 'general', 'https://uapis.cn/api/v1/game/epic-free', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_minecraft_version', 'Minecraft 最新版本 - 需要在启动器、服务器面板或机器人里实时显示 Minecraft 的最新版本？这个接口帮你一键拿到当前的正式版和快照版。

## 功能概述
无需任何参数，直接返回最新正式版（latest release）、最新快照版（latest snapshot）以及完整的版本列表。适合做版本提示、更新检测或服务端版本看板。

## 使用须知
> [!NOTE]
> 数据会随新版本发布而更新，建议在客户端适当缓存，无需高频轮询。', 'general', 'https://uapis.cn/api/v1/game/minecraft/version', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_steam_servers', '查询 Steam 游戏服务器 - 想在自己的面板或社区里展示某款游戏的在线服务器？这个接口支持查询使用 A2S/Steam 服务器列表的多人游戏，例如 SCUM、ARK、Rust、CS2 等。

## 功能概述
传入游戏的 Steam AppID，即可获取当前在线的服务器列表，包含名称、IP、端口、当前/最大人数、地图等信息。你还可以用 `name` 做服务器名称模糊搜索，用 `limit` 控制返回数量。

## 常见 AppID
- SCUM：`513710`
- ARK：`346110`
- Rust：`252490`
- Counter-Strike 2：`730`

## 使用须知
> [!NOTE]
> 不确定游戏的 AppID？可以在 Steam 商店页地址中找到，或参考上面的常见 AppID 列表。', 'general', 'https://uapis.cn/api/v1/game/steam/servers?appid={{appid}}&name={{name}}&limit={{limit}}', 'GET', '{}', NULL, NULL, '[{"name":"appid","type":"number","required":true,"description":"Steam 游戏 AppID，必须是正整数。"},{"name":"name","type":"string","required":false,"description":"服务器名称关键词，可选，支持模糊搜索。"},{"name":"limit","type":"number","required":false,"description":"返回数量上限，默认 20，最大 100。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_game_minecraft_mods', '搜索 MC Mod/插件 - 想给你的启动器、服务器面板或资源推荐页加上 Mod/插件搜索？这个接口一次帮你检索 Modrinth 与 SpigotMC 上的资源。

## 功能概述
传入关键词，即可拿到资源名称、简介、作者、下载量、评分、项目页和下载地址。可以用 `source` 指定只搜某个平台，用 `type` 过滤资源类型，用 `limit` 控制每个平台返回的数量。

## 使用须知
> [!NOTE]
> 默认会补全作者名与下载直链。如果只想要更快的基础搜索结果，设置 `enrich=false` 即可降低延迟。', 'general', 'https://uapis.cn/api/v1/game/minecraft/mods?query={{query}}&source={{source}}&type={{type}}&limit={{limit}}&enrich={{enrich}}', 'GET', '{}', NULL, NULL, '[{"name":"query","type":"string","required":true,"description":"搜索关键词，也可使用别名 `q`。"},{"name":"source","type":"string","required":false,"description":"搜索来源，默认 all。"},{"name":"type","type":"string","required":false,"description":"资源类型过滤，例如 mod 或 plugin。"},{"name":"limit","type":"number","required":false,"description":"每个来源返回的最大条数，默认 10，最大 50。"},{"name":"enrich","type":"boolean","required":false,"description":"是否补全下载直链与作者名，默认 true；传 false 可降低延迟。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_image_bing_daily', '获取必应每日壁纸 - 这个接口可以获取最新或指定日期的必应壁纸。默认直接返回图片，也可以传 `format=json` 获取元数据，或者传 `format=redirect` 直接跳转到最终图片地址。

## 功能概述
- 不传参数时，默认返回当天壁纸图片二进制
- 可以传 `date` 查询指定日期的壁纸
- 可以传 `resolution` 选择 `4k` 或 `1080`
- 可以传 `format` 控制返回图片、JSON 或 302 跳转
- 当传 `format=json` 时，返回的是扁平 JSON 对象，里面会包含标题、副标题、说明文案、版权信息、问答信息和图片地址等字段

## 参数说明
`resolution` 默认是 `4k`。
`format` 默认是 `image`。', 'general', 'https://uapis.cn/api/v1/image/bing-daily?date={{date}}&random={{random}}&resolution={{resolution}}&format={{format}}', 'GET', '{}', NULL, NULL, '[{"name":"date","type":"string","required":false,"description":"壁纸日期，格式是 `YYYY-MM-DD`。不传时返回当天壁纸。"},{"name":"random","type":"boolean","required":false,"description":"是否每次请求随机返回一张历史壁纸。传 `true` 时生效；不能和 `date` 同时使用。不传或传 `false` 时保持默认当天/指定日期逻辑。"},{"name":"resolution","type":"string","required":false,"description":"返回图片的目标分辨率。可以传 `4k` 或 `1080`，不传时默认是 `4k`。"},{"name":"format","type":"string","required":false,"description":"响应格式。可以传 `image`、`json` 或 `redirect`。不传时默认是 `image`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_image_bing_daily_history', '查询必应壁纸历史 - 这个接口用于查询必应壁纸历史列表，也可以按日期精确查询某一天。默认按时间倒序返回 JSON。

## 功能概述
- 可以传 `date` 精确查询某一天，命中后只返回 1 条数据
- 不传 `date` 时，按时间倒序分页返回历史列表
- 可以传 `resolution` 让 `image_url` 直接对应 `4k` 或 `1080`
- 可以传 `page` 和 `page_size` 控制分页
- 每条记录都是扁平 JSON 对象，里面会包含标题、副标题、说明文案、版权信息、问答信息和图片地址等字段

## 参数说明
`resolution` 默认是 `4k`。
`page` 默认是 `1`，`page_size` 默认是 `30`，最大是 `100`。
当传了 `date` 以后，`page` 和 `page_size` 不生效。', 'general', 'https://uapis.cn/api/v1/image/bing-daily/history?date={{date}}&resolution={{resolution}}&page={{page}}&page_size={{page_size}}', 'GET', '{}', NULL, NULL, '[{"name":"date","type":"string","required":false,"description":"壁纸日期，格式是 `YYYY-MM-DD`。传了以后会按日期精确查询，并且忽略 `page` 和 `page_size`。"},{"name":"resolution","type":"string","required":false,"description":"返回图片的目标分辨率。可以传 `4k` 或 `1080`，不传时默认是 `4k`。"},{"name":"page","type":"number","required":false,"description":"分页页码，必须是正整数。不传时默认是 `1`。只有在不传 `date` 时才生效。"},{"name":"page_size","type":"number","required":false,"description":"每页条数，必须是正整数。不传时默认是 `30`，最大是 `100`。只有在不传 `date` 时才生效。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_frombase64', '通过Base64编码上传图片 - 当你需要在前端处理完图片（比如裁剪、加滤镜后），不通过传统表单，而是直接上传图片的场景，这个接口就派上用场了。

## 功能概述
你只需要将图片的 Base64 编码字符串发送过来，我们就会把它解码、保存为图片文件，并返回一个可供访问的公开 URL。

## 使用须知

> [!IMPORTANT]
> **关于 `imageData` 格式**
> 你发送的 `imageData` 字符串必须是完整的 Base64 Data URI 格式，它需要包含 MIME 类型信息，例如 `data:image/png;base64,iVBORw0KGgo...`。缺少 `data:image/...;base64,` 前缀将导致解码失败。', 'general', 'https://uapis.cn/api/v1/image/frombase64', 'POST', '{}', '{"imageData":"{{imageData}}"}', NULL, '[{"name":"imageData","type":"string","required":true,"description":"图片的Base64 Data URI，必须包含MIME类型头。例如：`data:image/png;base64,...`"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_image_motou', '生成摸摸头GIF (QQ号) - 想在线rua一下好友的头像吗？这个趣味接口可以满足你。

## 功能概述
此接口通过GET方法，专门用于通过QQ号生成摸摸头GIF。你只需要提供一个QQ号码，我们就会自动获取其公开头像，并制作成一个可爱的动图。

## 使用须知
- **响应格式**：接口成功时直接返回 `image/gif` 格式的二进制数据。
- **背景颜色**：你可以通过 `bg_color` 参数来控制GIF的背景。使用 `transparent` 选项可以让它更好地融入各种聊天背景中。', 'general', 'https://uapis.cn/api/v1/image/motou?qq={{qq}}&bg_color={{bg_color}}', 'GET', '{}', NULL, NULL, '[{"name":"qq","type":"string","required":true,"description":"你想要摸头的对象的QQ号码。"},{"name":"bg_color","type":"string","required":false,"description":"GIF的背景颜色。留空则由后端服务决定默认值。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_motou', '生成摸摸头GIF - 除了使用QQ头像，你还可以通过上传自己的图片或提供图片URL来制作独一无二的摸摸头GIF。

## 功能概述
此接口通过POST方法，支持两种方式生成GIF：
1.  **图片URL**：在表单中提供 `image_url` 字段。
2.  **上传图片**：在表单中上传 `file` 文件。

## 使用须知
- **响应格式**：接口成功时直接返回 `image/gif` 格式的二进制数据。
- **参数优先级**：如果同时提供了 `image_url` 和上传的 `file` 文件，系统将 **优先使用 `image_url`**。
- **背景颜色**：同样支持 `bg_color` 表单字段来控制GIF背景。', 'general', 'https://uapis.cn/api/v1/image/motou', 'POST', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_speechless', '生成你们怎么不说话了表情包 - 你们怎么不说话了？是不是都在偷偷玩Uapi，求求你们不要玩Uapi了

## 使用须知
- **响应格式**：接口成功时直接返回 `image/png` 格式的二进制数据。
- **文字内容**：至少需要提供 `top_text`（上方文字）或 `bottom_text`（下方文字）之一。
- **梗图逻辑**：上方描述某个行为，下方通常以「们」开头表示劝阻，形成戏谑的对比效果。', 'general', 'https://uapis.cn/api/v1/image/speechless', 'POST', '{}', '{"top_text":"{{top_text}}","bottom_text":"{{bottom_text}}"}', NULL, '[{"name":"top_text","type":"string","required":false,"description":"表情包上方的文字内容。你们怎么不说话了，是不是都在偷偷 _______"},{"name":"bottom_text","type":"string","required":false,"description":"表情包下方的文字内容。求求你_______"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_image_qrcode', '生成二维码 - 无论是网址、文本还是联系方式，通通可以变成一个二维码！这是一个非常灵活的二维码生成工具。

## 功能概述
你提供一段文本内容，我们为你生成对应的二维码图片。你可以自定义尺寸、前景色、背景色，还支持透明背景，并选择不同的返回格式以适应不同场景。', 'general', 'https://uapis.cn/api/v1/image/qrcode?text={{text}}&size={{size}}&format={{format}}&transparent={{transparent}}&fgcolor={{fgcolor}}&bgcolor={{bgcolor}}', 'GET', '{}', NULL, NULL, '[{"name":"text","type":"string","required":true,"description":"你希望编码到二维码中的任何文本内容，比如一个URL、一段话或者一个JSON字符串。"},{"name":"size","type":"number","required":false,"description":"二维码图片的边长（正方形），单位是像素。有效范围是 256 到 2048 之间。"},{"name":"format","type":"string","required":false,"description":"指定响应内容的格式。可选值为 `image`, `json`, `json_url`。"},{"name":"transparent","type":"boolean","required":false,"description":"是否使用透明背景。启用后生成的 PNG 图片将具有 alpha 通道，背景透明。"},{"name":"fgcolor","type":"string","required":false,"description":"二维码前景色（即二维码本身的颜色），使用十六进制格式。URL 中需要将 `#` 编码为 `%23`。"},{"name":"bgcolor","type":"string","required":false,"description":"二维码背景色，使用十六进制格式。当 `transparent=true` 时此参数会被忽略。URL 中需要将 `#` 编码为 `%23`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_image_tobase64', '图片转 Base64 - 看到一张网上的图片，想把它转换成 Base64 编码以便嵌入到你的 HTML 或 CSS 中？用这个接口就对了。

## 功能概述
你提供一个公开可访问的图片 URL，我们帮你把它下载下来，并转换成包含 MIME 类型的 Base64 Data URI 字符串返回给你。', 'general', 'https://uapis.cn/api/v1/image/tobase64?url={{url}}', 'GET', '{}', NULL, NULL, '[{"name":"url","type":"string","required":true,"description":"需要转换为Base64的、可公开访问的图片URL地址。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_decode', '解码并缩放图片 - 在 RAM 和 Flash 极其有限的设备上解码图片是一项繁重的任务。这个接口专为 IoT 和嵌入式开发设计，将复杂的图像解码和缩放操作转移到云端，直接输出适用于单片机屏幕的二进制像素流。

## 功能概述
此接口提供了灵活的云端图像预处理能力，帮助硬件开发者跳过繁琐的图像处理逻辑：
- **直接推流渲染**：如果选择输出纯像素流（如 RGB565），单片机收到网络数据后无需解析文件头，可直接将其写入显存，实现极低内存占用的边下边播。
- **完美适配屏幕**：无需在设备端编写裁剪或补边代码。只需传入目标屏幕的物理分辨率，接口会自动完成等比缩放、居中补色或铺满裁剪，确保最终显示画面不变形。
- **精准内存分配**：在动态缩放图片的场景下，服务端会在 HTTP 响应头中提前注入 `X-Image-Width` 和 `X-Image-Height`，方便设备在读取真实的二进制数据前进行准确的内存分配。

## 使用须知
- **请求格式**：无论是上传本地文件还是传递图片链接，请求体都必须使用 `multipart/form-data` 编码格式。
- **网络资源获取**：当您选择传递图片链接时，服务端会自动尝试获取该资源。请确保您提供的图片链接是公网直接可访问的，且不需要任何形式的登录鉴权。', 'general', 'https://uapis.cn/api/v1/image/decode', 'POST', '{}', NULL, NULL, '[{"name":"width","type":"number","required":false,"description":"目标宽度，单位是像素。可以单独传，也可以和 `height` 一起传。与 `max_width`、`max_height` 互斥。"},{"name":"height","type":"number","required":false,"description":"目标高度，单位是像素。可以单独传，也可以和 `width` 一起传。与 `max_width`、`max_height` 互斥。"},{"name":"max_width","type":"number","required":false,"description":"最大宽度，单位是像素。只有在不传 `width`、`height` 时才生效，会按原比例缩放。"},{"name":"max_height","type":"number","required":false,"description":"最大高度，单位是像素。只有在不传 `width`、`height` 时才生效，会按原比例缩放。"},{"name":"format","type":"string","required":false,"description":"输出格式。可以传 `bmp`、`rgb565` 或 `rgb888`，不传时默认是 `bmp`。"},{"name":"color_mode","type":"string","required":false,"description":"BMP 输出的颜色模式。只有在 `format=bmp` 时才生效，可以传 `RGB565` 或 `RGB888`，不传时默认是 `RGB888`。"},{"name":"fit","type":"string","required":false,"description":"缩放模式。可以传 `contain`、`cover` 或 `fill`，不传时默认是 `contain`。当传 `cover` 或 `fill` 时，`width` 和 `height` 都要传。"},{"name":"background","type":"string","required":false,"description":"背景色。可以传 `black`、`white` 或 `#RRGGBB`，不传时默认是 `black`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_svg', 'SVG转图片 - 需要将灵活的 SVG 矢量图形转换为常见的光栅图像格式吗？这个接口可以帮你轻松实现。

## 功能概述
上传一个 SVG 文件，并指定目标格式（如 PNG、JPEG 等），接口将返回转换后的图像。你还可以调整输出图像的尺寸和（对于JPEG）压缩质量，以满足不同场景的需求。', 'general', 'https://uapis.cn/api/v1/image/svg', 'POST', '{}', NULL, NULL, '[{"name":"format","type":"string","required":false,"description":"输出图像的目标格式。支持的值：`png`, `jpeg`, `jpg`, `gif`, `tiff`, `bmp`。"},{"name":"width","type":"number","required":false,"description":"输出图像的宽度（像素）。如果省略，将根据 `height` 保持宽高比，或者使用 SVG 的原始宽度。"},{"name":"height","type":"number","required":false,"description":"输出图像的高度（像素）。如果省略，将根据 `width` 保持宽高比，或者使用 SVG 的原始高度。"},{"name":"quality","type":"number","required":false,"description":"JPEG 图像的压缩质量（1-100）。仅当 `format` 为 `jpeg` 或 `jpg` 时有效。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_compress', '无损压缩图片 - 还在为图片体积和加载速度发愁吗？体验一下我们强大的**无损压缩服务**，它能在几乎不牺牲任何肉眼可感知的画质的前提下，将图片体积压缩到极致。

## 功能概述
你只需要上传一张常见的图片（如 PNG, JPG），选择一个压缩等级，就能获得一个体积小到惊人的压缩文件。这对于需要大量展示高清图片的网站、App 或小程序来说，是优化用户体验、节省带宽和存储成本的利器。

## 使用须知
> [!TIP]
> 图片越大或压缩等级越高，处理时间可能越长，请您耐心等待。

> [!WARNING]
> **处理时间提醒**
> 在访问量较高时，处理时间可能进一步延长。如果您的业务对返回时间比较敏感，建议预留充足的处理时间。

### 请求与响应格式
- 请求必须使用 `multipart/form-data` 格式上传文件。
- 成功响应将直接返回压缩后的文件二进制流 (`image/*`)，并附带 `Content-Disposition` 头，建议客户端根据此头信息保存文件。

## 参数详解
### `level` (压缩等级)
这是一个从 `1` 到 `5` 的整数，它决定了压缩的强度和策略，数字越小，压缩率越高。所有等级都经过精心调校，以在最大化压缩率的同时保证出色的视觉质量。
- `1`: **极限压缩** (推荐，体积最小，画质优异)
- `2`: **高效压缩**
- `3`: **智能均衡** (默认选项)
- `4`: **画质优先**
- `5`: **专业保真** (压缩率稍低，保留最多图像信息)

## 错误处理指南
- **400 Bad Request**: 通常因为没有上传文件，或者 `level` 参数不在 1-5 的范围内。
- **500 Internal Server Error**: 如果在压缩过程中服务器发生内部错误，会返回此状态码。', 'general', 'https://uapis.cn/api/v1/image/compress', 'POST', '{}', NULL, NULL, '[{"name":"level","type":"number","required":false,"description":"压缩强度 (1-5)，默认为 3。数字越小，压缩率越高。"},{"name":"format","type":"string","required":false,"description":"输出图片格式，可以是 ''''png'''' 或 ''''jpeg''''。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_avatar_gravatar', '获取Gravatar头像 - 提供稳定、易用的头像获取能力，适合在网页或应用中直接展示头像。', 'general', 'https://uapis.cn/api/v1/avatar/gravatar?email={{email}}&hash={{hash}}&s={{s}}&d={{d}}&r={{r}}', 'GET', '{}', NULL, NULL, '[{"name":"email","type":"string","required":false,"description":"用户的 Email 地址。如果未提供 `hash` 参数，则此参数为必需。"},{"name":"hash","type":"string","required":false,"description":"用户 Email 地址的小写 MD5 哈希值。如果提供此参数，将忽略 `email` 参数。"},{"name":"s","type":"number","required":false,"description":"头像的尺寸，单位为像素。有效范围是 1 到 2048。"},{"name":"d","type":"string","required":false,"description":"当用户没有自己的 Gravatar 头像时，显示的默认头像类型。可选值包括 `mp`, `identicon`, `monsterid`, `wavatar`, `retro`, `robohash`, `blank`, `404`。"},{"name":"r","type":"string","required":false,"description":"头像分级。可选值：`g`, `pg`, `r`, `x`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_ocr', '通用 OCR 文字识别 - 无论您是需要实现票据的自动化录入，还是在网页前端对图片上的文字进行坐标框选，这个高精度的 OCR 接口都能为您提供强大的基础能力。

## 功能概述
> [!IMPORTANT]
> 如果您只关心图片上写了什么（例如截图取字或内容安全审核），强烈建议将 `need_location` 设置为 `false`。这会大幅精简返回的 JSON 数据体积，提升网络传输与系统解析效率。

除了常规的图片转文字，这个接口还针对实际开发场景做了一些实用设计：
- **前端文字高亮与结构化分析**：默认返回每一段文字的矩形坐标和四个顶点坐标。这非常适合使用 Canvas 在原图上画框高亮，或者在后端根据相对位置提取票据中的键值对信息。
- **复杂拍摄环境下的抗畸变**：针对手机拍摄导致的旋转或倾斜，可以开启 `enable_cls=true`。服务端在识别前会自动进行方向预校正，显著提升识别准确率。
- **灵活的输入与请求要求**：接口支持 `file`、`url` 或 `image_base64` 三种方式输入。请确保请求格式为 `multipart/form-data`，且图片链接在公网可直接访问。', 'general', 'https://uapis.cn/api/v1/image/ocr', 'POST', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_image_nsfw', '图片敏感检测 - 这是一个图片内容审核接口，自动识别图片中的违规内容并返回处理建议。

## 功能概述
上传图片文件或提供图片URL，接口会自动分析图片内容，返回是否违规、风险等级和处理建议。适合对接到用户上传流程中，实现自动化内容审核。

## 返回字段说明
- **is_nsfw**: 是否判定为违规内容，`true` 表示违规，`false` 表示正常
- **nsfw_score**: 违规内容置信度，0-1 之间，越高表示越可能违规
- **normal_score**: 正常内容置信度，0-1 之间，与 nsfw_score 互补
- **suggestion**: 处理建议
  - `pass`: 内容正常，可以直接放行
  - `review`: 存在风险，建议转人工复核
  - `block`: 高风险内容，建议直接拦截
- **risk_level**: 风险等级
  - `low`: 低风险
  - `medium`: 中风险
  - `high`: 高风险
- **label**: 内容标签，`nsfw` 或 `normal`
- **confidence**: 模型对当前判断的整体置信度
- **inference_time_ms**: 模型推理耗时，单位毫秒', 'general', 'https://uapis.cn/api/v1/image/nsfw', 'POST', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_hotboard', '查询热榜 - 想快速跟上网络热点？这个接口让你一网打尽各大主流平台的实时热榜/热搜！

## 功能概述
你只需要指定一个平台类型，就能获取到该平台当前的热榜数据列表。每个热榜条目都包含标题、热度值和原始链接。非常适合用于制作信息聚合类应用或看板。

## 三种使用模式

### 默认模式
只传 `type` 参数，返回该平台当前的实时热榜。

### 时光机模式
传 `type` + `time` 参数，返回指定时间附近最近可展示的历史热榜快照。

### 搜索模式
传 `type` + `keyword` + `time_start` + `time_end` 参数，在指定历史时间范围内搜索包含关键词的热榜条目。可选传 `limit` 限制返回数量。', 'general', 'https://uapis.cn/api/v1/misc/hotboard?type={{type}}&time={{time}}&keyword={{keyword}}&time_start={{time_start}}&time_end={{time_end}}&limit={{limit}}', 'GET', '{}', NULL, NULL, '[{"name":"type","type":"string","required":true,"description":"你想要查询的热榜平台。请从[支持的平台列表](#enum-list)中选择。"},{"name":"time","type":"number","required":false,"description":"时光机模式：毫秒时间戳，返回该时间附近最近可展示的历史热榜快照。不传则返回当前实时热榜。"},{"name":"keyword","type":"string","required":false,"description":"搜索模式：搜索关键词，在指定历史时间范围内搜索包含该关键词的条目。需配合 time_start 和 time_end 使用。"},{"name":"time_start","type":"number","required":false,"description":"搜索模式必填：搜索起始时间戳（毫秒），需位于该平台历史数据覆盖范围内。"},{"name":"time_end","type":"number","required":false,"description":"搜索模式必填：搜索结束时间戳（毫秒），需晚于 time_start 且位于该平台历史数据覆盖范围内。"},{"name":"limit","type":"number","required":false,"description":"搜索模式下最大返回条数，默认 50，最大 200。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_movie_box_office', '查询电影票房 - 正在做影视类应用，想直观展示今天哪部电影最卖座？大盘总票房突破了多少？这个接口能帮你实时获取院线大盘和影片票房排名。

## 功能概述
调用此接口，无需任何参数，即可获取当前实时的电影市场大盘数据（包含总票房、总场次、总人次），以及每一部上映影片的具体表现（包括票房明细、排片占比、上座率、场均人次和累计票房等）。', 'general', 'https://uapis.cn/api/v1/misc/movie-box-office', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_phoneinfo', '查询手机归属地 - 想知道一个手机号码来自哪里？是移动、联通还是电信？这个接口可以告诉你答案。

## 功能概述
提供一个国内的手机号码，我们会查询并返回它的归属地（省份和城市）以及所属的运营商信息。', 'general', 'https://uapis.cn/api/v1/misc/phoneinfo?phone={{phone}}', 'GET', '{}', NULL, NULL, '[{"name":"phone","type":"string","required":true,"description":"需要查询的11位中国大陆手机号码。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_randomnumber', '随机数生成 - 需要一个简单的随机数，还是需要一串不重复的、带小数的随机数？这个接口都能满足你！

## 功能概述
这是一个强大的随机数生成器。你可以指定生成的范围（最大/最小值）、数量、是否允许重复、以及是否生成小数（并指定小数位数）。

## 流程图
```mermaid
graph TD
    A[开始] --> B{参数校验};
    B --> |通过| C{是否允许小数?};
    C --> |是| D[生成随机小数];
    C --> |否| E[生成随机整数];
    D --> F{是否允许重复?};
    E --> F;
    F --> |是| G[直接生成指定数量];
    F --> |否| H[生成不重复的数字];
    G --> I[返回结果];
    H --> I;
    B --> |失败| J[返回 400 错误];
```
## 使用须知
> [!WARNING]
> **不重复生成的逻辑限制**
> 当设置 `allow_repeat=false` 时，请确保取值范围 `(max - min + 1)` 大于或等于你请求的数量 `count`。否则，系统将无法生成足够的不重复数字，请求会失败并返回 400 错误。', 'general', 'https://uapis.cn/api/v1/misc/randomnumber?min={{min}}&max={{max}}&count={{count}}&allow_repeat={{allow_repeat}}&allow_decimal={{allow_decimal}}&decimal_places={{decimal_places}}', 'GET', '{}', NULL, NULL, '[{"name":"min","type":"number","required":false,"description":"生成随机数的最小值（包含）。"},{"name":"max","type":"number","required":false,"description":"生成随机数的最大值（包含）。"},{"name":"count","type":"number","required":false,"description":"需要生成的随机数的数量。"},{"name":"allow_repeat","type":"boolean","required":false,"description":"是否允许生成的多个数字中出现重复值。"},{"name":"allow_decimal","type":"boolean","required":false,"description":"是否生成小（浮点）数。如果为 false，则只生成整数。"},{"name":"decimal_places","type":"number","required":false,"description":"如果 `allow_decimal=true`，这里可以指定小数的位数。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_timestamp', '转换时间戳 (旧版，推荐使用/convert/unixtime) - 这是一个用于将Unix时间戳转换为人类可读日期时间的旧版接口。

## 功能概述
输入一个秒级或毫秒级的时间戳，返回其对应的本地时间和UTC时间。

> [!WARNING]
> **接口已过时**：这个接口已被新的 `/convert/unixtime` 取代。新接口功能更强大，支持双向转换。我们建议你迁移到新接口。

[➡️ 前往新版接口文档](/docs/api-reference/get-convert-unixtime)', 'general', 'https://uapis.cn/api/v1/misc/timestamp?ts={{ts}}', 'GET', '{}', NULL, NULL, '[{"name":"ts","type":"string","required":true,"description":"需要转换的Unix时间戳，支持10位（秒）或13位（毫秒）。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_weather', '查询天气 - 出门前，查一下天气总是个好习惯。这个接口为你提供精准、实时的天气数据，支持国内和国际城市。

## 功能概述
这个接口支持三种查询方式：
- 可以传 `adcode`，按行政区编码查询（优先级最高）
- 可以传 `city`，按城市名称查询，支持中文（`北京`）和英文（`Tokyo`）
- 两个都不传时，按客户端 IP 自动定位查询

支持 `lang` 参数，可选 `zh`（默认）和 `en`，城市名翻译覆盖 7000+ 城市。

## 可选功能模块
- `extended=true`：扩展气象字段（体感温度、能见度、气压、紫外线、空气质量及污染物分项数据）
- `forecast=true`：多天预报（最多7天，会额外返回每天的最高温度、最低温度，以及日出日落、风速等详细数据）
- `hourly=true`：逐小时预报（24小时）
- `minutely=true`：分钟级降水预报（仅国内城市，精确到2分钟）
- `indices=true`：18项生活指数（穿衣、紫外线、洗车、运动、花粉等）

## 天气字段说明
`weather` 是天气现象文本，不是固定枚举。

常见值包括：晴、多云、阴、小雨、中雨、大雨、雷阵雨、小雪、中雪、大雪、雨夹雪、雾、霾、沙尘。

如果你的业务需要稳定的天气分类，建议使用 `weather_code` 进行映射。完整的天气图标代码请参考[天气图标代码表](#enum-list)。', 'general', 'https://uapis.cn/api/v1/misc/weather?city={{city}}&adcode={{adcode}}&extended={{extended}}&forecast={{forecast}}&hourly={{hourly}}&minutely={{minutely}}&indices={{indices}}&lang={{lang}}', 'GET', '{}', NULL, NULL, '[{"name":"city","type":"string","required":false,"description":"城市名称，支持中文（`北京`）和英文（`Tokyo`）。可选参数，不传时会尝试 IP 自动定位。"},{"name":"adcode","type":"string","required":false,"description":"城市行政区划代码（如 `110000`），优先级高于 city。可选参数，不传时会尝试 IP 自动定位。"},{"name":"extended","type":"boolean","required":false,"description":"返回扩展气象字段（体感温度、能见度、气压、紫外线、降水量、云量、空气质量指数及污染物分项数据）。"},{"name":"forecast","type":"boolean","required":false,"description":"返回多天预报数据（最多7天），含每天的最高温度、最低温度、白天夜间天气、风向风力、日出日落等。"},{"name":"hourly","type":"boolean","required":false,"description":"返回逐小时预报（24小时），含温度、天气、风向风速、湿度、降水概率等。"},{"name":"minutely","type":"boolean","required":false,"description":"返回分钟级降水预报（仅国内城市），精确到2分钟。"},{"name":"indices","type":"boolean","required":false,"description":"返回18项生活指数（穿衣、紫外线、洗车、晾晒、空调、感冒、运动、舒适度、出行、钓鱼、过敏、防晒、心情、啤酒、雨伞、交通、空气净化器、花粉）。"},{"name":"lang","type":"string","required":false,"description":"返回语言。`zh` 返回中文（默认），`en` 返回英文。城市名翻译覆盖 7000+ 城市。生活指数（`indices`）目前仅支持中文。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_worldtime', '查询世界时间 - 需要和国外的朋友开会，想知道他那边现在几点？用这个接口一查便知。

## 功能概述
根据标准的时区名称（例如 ''Asia/Shanghai'' 或 ''Europe/London''），获取该时区的当前准确时间、UTC偏移量、星期等信息。', 'general', 'https://uapis.cn/api/v1/misc/worldtime?city={{city}}', 'GET', '{}', NULL, NULL, '[{"name":"city","type":"string","required":true,"description":"你需要查询的城市或地区。请从[支持的时区列表](#enum-list)中选择标准 IANA 时区名称，例如 ''''Asia/Shanghai'''', ''''Asia/Tokyo'''', ''''America/New_York''''。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_lunartime', '查询农历时间 - 需要在指定时区下查看某个时间点的农历信息？这个接口可以直接返回完整结果。

## 功能概述
支持传入 Unix 时间戳（秒或毫秒）和 IANA 时区名，返回公历时间、星期、农历年月日、干支、生肖、节气与节日信息。不传 `ts` 时默认使用当前时间，不传 `timezone` 时默认 `Asia/Shanghai`。

## 时区说明
- 支持标准 IANA 时区，例如 `Asia/Shanghai`、`Asia/Tokyo`
- 也支持别名：`Shanghai`、`Beijing`
- 时区非法时返回 400 并提示 `invalid timezone: xxx`', 'general', 'https://uapis.cn/api/v1/misc/lunartime?ts={{ts}}&timezone={{timezone}}', 'GET', '{}', NULL, NULL, '[{"name":"ts","type":"string","required":false,"description":"Unix 时间戳，支持 10 位秒级或 13 位毫秒级。不传则默认当前时间。"},{"name":"timezone","type":"string","required":false,"description":"时区名称。支持 IANA 时区（如 Asia/Shanghai）和别名（Shanghai、Beijing）。默认 Asia/Shanghai。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_holiday_calendar', '查询节假日与万年历 - 查询指定日期、月份或年份的万年历与节假日信息。

## 功能概述
这个接口支持三种查询方式：按天（`date`）、按月（`month`）和按年（`year`）。调用时三者选一个传入即可。

如果你只关心某一类事件，可以通过 `holiday_type` 进行筛选，例如只看法定休假/调休、公历节日、农历节日或节气。

在 `date` 模式下，传 `include_nearby=true` 可以额外返回该日期前后最近的节日；返回数量由 `nearby_limit` 控制，默认 7，最大 30。

如果你只想保留今天和之后的节日，可以再传 `exclude_past=true` 过滤已经过去的节日。', 'general', 'https://uapis.cn/api/v1/misc/holiday-calendar?date={{date}}&month={{month}}&year={{year}}&timezone={{timezone}}&holiday_type={{holiday_type}}&include_nearby={{include_nearby}}&nearby_limit={{nearby_limit}}&exclude_past={{exclude_past}}', 'GET', '{}', NULL, NULL, '[{"name":"date","type":"string","required":false,"description":"按天查询时填写这个参数，例如查某一天。格式：`YYYY-MM-DD`。和 `month`、`year` 三选一。"},{"name":"month","type":"string","required":false,"description":"按月查询时填写这个参数，例如查某个月。格式：`YYYY-MM`。和 `date`、`year` 三选一。"},{"name":"year","type":"string","required":false,"description":"按年查询时填写这个参数，例如查某一年。格式：`YYYY`。和 `date`、`month` 三选一。"},{"name":"timezone","type":"string","required":false,"description":"时区名称，默认 Asia/Shanghai。"},{"name":"holiday_type","type":"string","required":false,"description":"节日筛选类型，默认 all。"},{"name":"include_nearby","type":"boolean","required":false,"description":"是否返回前后最近节日，仅 date 模式生效，默认 false。month/year 模式会忽略此参数。"},{"name":"nearby_limit","type":"number","required":false,"description":"返回最近节日数量限制，默认 7，最大 30。仅 date 模式 + include_nearby=true 生效。"},{"name":"exclude_past","type":"boolean","required":false,"description":"传 true 时，会过滤今天之前已经过去的节日。默认 false。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_history_programmer_today', '程序员历史上的今天 - 想知道程序员历史上的今天发生了什么大事吗？这个接口告诉你答案！

## 功能概述
我们使用AI智能筛选从海量历史事件中挑选出与程序员、计算机科学相关的重要事件。每个事件都经过重要性评分和相关性评分，确保内容质量。', 'general', 'https://uapis.cn/api/v1/history/programmer/today', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_history_programmer', '程序员历史事件 - 想查看程序员历史上某个特定日期发生的大事件？指定月份和日期，我们就能告诉你！

## 功能概述
通过指定月份和日期，获取该日发生的程序员相关历史事件。同样使用AI智能筛选，确保事件的相关性和重要性。', 'general', 'https://uapis.cn/api/v1/history/programmer?month={{month}}&day={{day}}', 'GET', '{}', NULL, NULL, '[{"name":"month","type":"number","required":true,"description":"月份，1-12之间的整数。"},{"name":"day","type":"number","required":true,"description":"日期，1-31之间的整数。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_tracking_query', '查询快递物流信息 - 买了东西想知道快递到哪儿了？这个接口帮你实时追踪物流状态。

## 功能概述
提供一个快递单号，系统会自动识别快递公司并返回完整的物流轨迹信息。这个接口目前可以查询中通、圆通、韵达、申通、极兔、顺丰、京东、EMS、德邦等主流快递公司的物流信息。

## 使用须知
- **自动识别**：不知道是哪家快递？系统会根据单号规则自动识别快递公司（推荐使用）
- **手动指定**：如果已知快递公司，可以传递 `carrier_code` 参数，查询速度会更快
- **手机尾号验证**：顺丰等部分快递公司需要验证收件人手机尾号才能查询详细物流，如果返回 `暂无物流信息`，建议尝试传入 `phone` 参数
- **查询时效**：物流信息实时查询，响应时间通常在1-2秒内', 'general', 'https://uapis.cn/api/v1/misc/tracking/query?tracking_number={{tracking_number}}&carrier_code={{carrier_code}}&phone={{phone}}', 'GET', '{}', NULL, NULL, '[{"name":"tracking_number","type":"string","required":true,"description":"快递单号，通常是一串10-20位的数字或字母数字组合。"},{"name":"carrier_code","type":"string","required":false,"description":"快递公司编码（可选）。不填写时系统会自动识别，填写后可加快查询速度。"},{"name":"phone","type":"string","required":false,"description":"收件人手机尾号，4位数字（可选）。部分快递公司需要验证手机尾号才能查询详细物流信息。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_tracking_detect', '识别快递公司 - 不确定手里的快递单号属于哪家快递公司？这个接口专门做识别，不查物流。

## 功能概述
输入快递单号，系统会根据单号规则快速识别出最可能的快递公司。如果存在多个可能的匹配结果，还会在 `alternatives` 字段中返回备选项，供你参考选择。

## 使用须知
- **识别速度快**：只做规则匹配，不查询物流信息，响应速度通常在100ms内
- **准确率高**：基于各快递公司的单号规则进行智能识别，准确率超过95%
- **备选方案**：当单号规则可能匹配多家快递公司时，会提供所有可能的选项', 'general', 'https://uapis.cn/api/v1/misc/tracking/detect?tracking_number={{tracking_number}}', 'GET', '{}', NULL, NULL, '[{"name":"tracking_number","type":"string","required":true,"description":"需要识别的快递单号。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_tracking_carriers', '获取支持的快递公司列表 - 不确定系统支持哪些快递公司？这个接口返回完整的支持列表。

## 功能概述
获取系统当前支持的所有快递公司列表，包括每家公司的标准编码（code）和中文名称（name）。

## 使用建议
- **推荐缓存**：这个列表基本不会频繁变动，建议在应用启动时调用一次并缓存到本地
- **应用场景**：适合用于构建快递公司选择器、下拉菜单等UI组件
- **缓存时长**：建议缓存24小时或更久', 'general', 'https://uapis.cn/api/v1/misc/tracking/carriers', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_misc_date_diff', '计算两个日期之间的时间差值 - 想知道两个日期之间相差多久？这个接口帮你精确计算时间差值。

## 功能概述
输入开始日期和结束日期，返回它们之间的时间差，包括总天数、总小时数、总分钟数、总秒数、总周数，以及人性化显示格式（如"1年2月3天"）。

## 日期格式
接口支持自动识别常见日期格式，包括：YYYY-MM-DD、YYYY/MM/DD、DD-MM-YYYY、ISO 8601（带时区）等。也可以通过`format`参数显式指定格式（如DD-MM-YYYY）。

> [!NOTE]
> 当结束日期早于开始日期时，返回的数值为负数。', 'general', 'https://uapis.cn/api/v1/misc/date-diff', 'POST', '{}', '{"start_date":"{{start_date}}","end_date":"{{end_date}}","format":"{{format}}"}', NULL, '[{"name":"start_date","type":"string","required":true,"description":"开始日期，支持多种格式自动识别"},{"name":"end_date","type":"string","required":true,"description":"结束日期，支持多种格式自动识别"},{"name":"format","type":"string","required":false,"description":"日期格式（可选），如DD-MM-YYYY。不指定则自动识别"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_district', 'Adcode 国内外行政区域查询 - 一个接口，覆盖全球 243 个国家、中国省/市/区/街道四级行政区划，支持关键词搜索、行政编码查询、坐标反查三种查询模式（必须至少传入一种查询参数）。

## 功能概述
根据用户输入的搜索条件快速查找行政区域信息。例如：中国 > 山东省 > 济南市 > 历下区 > 舜华路街道。

无需注册、无需密钥，直接调用即可获取结构化的行政区域数据。支持三种查询方式：
- 传 `adcode`，按行政编码精确查询，同时返回下级区划列表
- 传 `lat` + `lng`，坐标反查附近地点
- 传 `keywords`，按关键词搜索，支持中英文

## 中国与国际数据差异
中国数据包含 `adcode`、`citycode` 等字段，支持省/市/区/街道四级逐级查询；国际城市数据不含这些字段，但额外提供 `population`（人口）和 `timezone`（时区）。

> [!NOTE]
> 部分城市（如东莞、文昌）没有区县层级，市级下方直接显示街道。街道级别的 `adcode` 返回的是所属区县的 `adcode`。', 'general', 'https://uapis.cn/api/v1/misc/district?keywords={{keywords}}&adcode={{adcode}}&lat={{lat}}&lng={{lng}}&level={{level}}&country={{country}}&limit={{limit}}', 'GET', '{}', NULL, NULL, '[{"name":"keywords","type":"string","required":false,"description":"关键词搜索（城市名、区县名，支持中英文）。"},{"name":"adcode","type":"string","required":false,"description":"中国行政区划代码精确查询（如 `110000`），同时返回下级行政区。"},{"name":"lat","type":"number","required":false,"description":"纬度，与 `lng` 配合使用，坐标反查附近地点。"},{"name":"lng","type":"number","required":false,"description":"经度，与 `lat` 配合使用。"},{"name":"level","type":"string","required":false,"description":"过滤行政级别。"},{"name":"country","type":"string","required":false,"description":"过滤国家代码（ISO 3166-1 alpha-2），如 `CN`、`JP`、`US`、`GB`。"},{"name":"limit","type":"number","required":false,"description":"返回数量上限，默认 `20`，最大 `100`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_weather_history', '查询历史天气 - 想知道某个城市过去一段时间有没有下雨、降雨量是多少？这个接口用于查询过去最多 366 天的城市每日历史天气。

## 功能概述
支持按 `city`、`adcode` 或客户端 IP 自动定位查询。你可以传 `start_date` + `end_date` 指定日期范围，也可以只传 `days` 回看最近若干天。返回结果重点包含 `rained` 与 `rain`，适合做出行复盘、农业记录、气象看板和数据分析。

## 使用须知
> [!NOTE]
> 定位优先级：`adcode` > `city` > IP 自动定位。同时传 `start_date` 和 `days` 时，以 `start_date` + `end_date` 区间为准。', 'general', 'https://uapis.cn/api/v1/misc/weather/history?city={{city}}&adcode={{adcode}}&start_date={{start_date}}&end_date={{end_date}}&days={{days}}&lang={{lang}}', 'GET', '{}', NULL, NULL, '[{"name":"city","type":"string","required":false,"description":"城市名称，支持中文或英文；可选，不传 city/adcode 时会尝试 IP 自动定位。"},{"name":"adcode","type":"string","required":false,"description":"6 位行政区划代码，优先级高于 city。"},{"name":"start_date","type":"string","required":false,"description":"起始日期，格式 YYYY-MM-DD；与 end_date 搭配使用。"},{"name":"end_date","type":"string","required":false,"description":"结束日期，格式 YYYY-MM-DD，默认昨天。"},{"name":"days","type":"number","required":false,"description":"回看天数，1-366，默认 365；仅在未指定 start_date 时生效。"},{"name":"lang","type":"string","required":false,"description":"返回语言：zh（默认）或 en。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_misc_movie_rating_rank', '电影收视排行查询 - 想做影视榜单页或选题分析？这个接口提供影视的收视、热度和评分排行，既能查实时榜，也能按日、周、月回看历史快照。

## 功能概述
用 `channel` 切换全网、卫视、网络平台或院线榜单，用 `period` + `date` 查询历史日榜、周榜和月榜。适合影视资讯页、数据看板、自媒体选题和内容运营分析。', 'general', 'https://uapis.cn/api/v1/misc/movie-rating-rank?channel={{channel}}&platform={{platform}}&limit={{limit}}&period={{period}}&date={{date}}', 'GET', '{}', NULL, NULL, '[{"name":"channel","type":"string","required":false,"description":"渠道：all（全网）、tv（卫视）、web（网络平台）、cinema（院线），默认 all。"},{"name":"platform","type":"string","required":false,"description":"按渠道或平台关键字过滤，例如 卫视、爱奇艺。"},{"name":"limit","type":"number","required":false,"description":"每个渠道仅返回前 N 条。"},{"name":"period","type":"string","required":false,"description":"排行周期：realtime、day、week、month，默认 realtime。"},{"name":"date","type":"string","required":false,"description":"历史快照日期，格式 YYYY-MM-DD；用于 day/week/month。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_dns', '执行DNS解析查询 - 想知道一个域名指向了哪个IP？或者它的邮件服务器是谁？这个接口就像一个在线的 `dig` 或 `nslookup` 工具。

## 功能概述
你可以查询指定域名的各种DNS记录，包括 `A` (IPv4), `AAAA` (IPv6), `CNAME` (别名), `MX` (邮件交换), `NS` (域名服务器) 和 `TXT` (文本记录)。', 'general', 'https://uapis.cn/api/v1/network/dns?domain={{domain}}&type={{type}}', 'GET', '{}', NULL, NULL, '[{"name":"domain","type":"string","required":true,"description":"你需要查询的域名，例如 ''''cn.bing.com''''。"},{"name":"type","type":"string","required":false,"description":"你想要查询的DNS记录类型。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_icp', '查询域名ICP备案信息 - 想知道一个网站的背后运营主体是谁吗？如果它是在中国大陆运营的，ICP备案信息可以告诉你答案。

## 功能概述
提供一个域名，查询其在中国工信部的ICP（Internet Content Provider）备案信息。这对于商业合作前的背景调查、验证网站合法性等场景很有帮助。

> [!NOTE]
> **查询范围**
> 此查询仅对在中国大陆工信部进行过备案的域名有效。对于国外域名或未备案的域名，将查询不到结果。', 'general', 'https://uapis.cn/api/v1/network/icp?domain={{domain}}', 'GET', '{}', NULL, NULL, '[{"name":"domain","type":"string","required":true,"description":"需要查询的域名或URL"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_ipinfo', '查询 IP - 想知道一个IP地址或域名来自哪里？这个接口可以帮你定位它。默认返回标准结果；如果传 `source=commercial`，可以返回更完整的位置信息。

## 功能概述
提供一个公网IPv4、IPv6地址或域名，我们会查询并返回它的地理位置（国家、省份、城市）、经纬度、以及所属的运营商（ISP）和自治系统（ASN）信息。这在网络安全分析、访问来源统计等领域非常有用。

当传 `source=commercial` 时，响应中会补充更完整的市、区、运营商、时区、海拔等信息，响应时间可能会稍长。', 'general', 'https://uapis.cn/api/v1/network/ipinfo?ip={{ip}}&source={{source}}', 'GET', '{}', NULL, NULL, '[{"name":"ip","type":"string","required":true,"description":"你需要查询的公网IP地址或域名（支持IPv4和IPv6）。"},{"name":"source","type":"string","required":false,"description":"查询结果类型。不传时返回标准结果；如果设置为 `commercial`，将返回更完整的地理位置信息，但响应时间可能会稍长。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_myip', '查询我的 IP - 想知道你自己的出口公网IP是多少吗？这个接口就是你的“网络身份证”。默认返回标准结果；如果传 `source=commercial`，可以返回更完整的位置信息。

## 功能概述
调用此接口，它会返回你（即发起请求的客户端）的公网IP地址，并附带与 `/network/ipinfo` 接口相同的地理位置和网络归属信息。非常适合用于在网页上向用户展示他们自己的IP和地理位置。

当传 `source=commercial` 时，响应中会补充更完整的市、区、运营商、时区、海拔等信息，响应时间可能会稍长。', 'general', 'https://uapis.cn/api/v1/network/myip?source={{source}}', 'GET', '{}', NULL, NULL, '[{"name":"source","type":"string","required":false,"description":"查询结果类型。不传时返回标准结果；如果设置为 `commercial`，将返回更完整的地理位置信息，但响应时间可能会稍长。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_ping', 'Ping 主机 - 想知道从我们的服务器到你的服务器网络延迟高不高？这个工具可以帮你测试网络连通性。

## 功能概述
这个接口会从我们的服务器节点对你指定的主机（域名或IP地址）执行 ICMP Ping 操作。它会返回最小、最大、平均延迟以及丢包率等关键指标，是诊断网络问题的得力助手。', 'general', 'https://uapis.cn/api/v1/network/ping?host={{host}}', 'GET', '{}', NULL, NULL, '[{"name":"host","type":"string","required":true,"description":"你需要 Ping 的目标主机，可以是域名或IP地址。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_pingmyip', 'Ping 我的 IP - 这是一个非常方便的快捷接口，想知道你的网络到我们服务器的回程延迟吗？点一下就行！

## 功能概述
这个接口是 `/network/myip` 和 `/network/ping` 的结合体。它会自动获取你客户端的公网IP，然后从我们的服务器Ping这个IP，并返回延迟数据。这对于快速判断你本地网络到服务器的连接质量非常有用。', 'general', 'https://uapis.cn/api/v1/network/pingmyip', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_portscan', '端口扫描 - 想检查一下你的服务器上某个端口（比如SSH的22端口或者Web的80端口）是否对外开放？这个工具可以帮你快速确认。

## 功能概述
你可以指定一个主机和端口号，我们的服务器会尝试连接该端口，并告诉你它是开放的（open）、关闭的（closed）还是超时了（timeout）。这对于网络服务配置检查和基本的安全扫描很有用。', 'general', 'https://uapis.cn/api/v1/network/portscan?host={{host}}&port={{port}}&protocol={{protocol}}', 'GET', '{}', NULL, NULL, '[{"name":"host","type":"string","required":true,"description":"需要扫描的目标主机，可以是域名或IP地址。"},{"name":"port","type":"number","required":true,"description":"需要扫描的端口号，范围是 1 到 65535。"},{"name":"protocol","type":"string","required":false,"description":"扫描使用的协议，可以是 ''''tcp'''' 或 ''''udp''''。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_urlstatus', '检查URL的可访问性状态 - 你的网站或API还好吗？用这个接口给它做个快速“体检”吧。

## 功能概述
提供一个URL，我们会向它发起一个请求，并返回其HTTP响应状态码。这是一种简单而有效的服务可用性监控方法。', 'general', 'https://uapis.cn/api/v1/network/urlstatus?url={{url}}', 'GET', '{}', NULL, NULL, '[{"name":"url","type":"string","required":true,"description":"你需要检查其可访问性状态的完整URL。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_whois', '查询域名的WHOIS注册信息 - 想知道一个域名是什么时候注册的、注册商是谁、什么时候到期？WHOIS信息可以告诉你这一切。

## 功能概述
这是一个在线的WHOIS查询工具。你可以通过如下两种方式获取WHOIS信息：

- **默认行为**（不带参数）：`GET /api/v1/network/whois?domain=google.com`
  - 返回一个JSON对象，`whois` 字段为原始、未处理的WHOIS文本字符串。
- **JSON格式化**：`GET /api/v1/network/whois?domain=google.com&format=json`
  - 返回一个JSON对象，`whois` 字段为解析后的JSON对象，包含WHOIS信息中的键值对。

这样你既可以获得最全的原始信息，也可以方便地处理结构化数据。', 'general', 'https://uapis.cn/api/v1/network/whois?domain={{domain}}&format={{format}}', 'GET', '{}', NULL, NULL, '[{"name":"domain","type":"string","required":true,"description":"你需要查询WHOIS信息的域名。"},{"name":"format","type":"string","required":false,"description":"返回格式。留空或为 ''''text'''' 时返回原始WHOIS文本，设为 ''''json'''' 时返回结构化JSON。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_network_wxdomain', '检查域名在微信中的访问状态 - 准备在微信里推广你的网站？最好先检查一下域名是否被“拉黑”了。

## 功能概述
这个接口可以帮你查询一个域名在微信内置浏览器中的访问状态，即是否被微信封禁。这对于做微信生态推广和营销的开发者来说至关重要。', 'general', 'https://uapis.cn/api/v1/network/wxdomain?domain={{domain}}', 'GET', '{}', NULL, NULL, '[{"name":"domain","type":"string","required":true,"description":"需要查询的域名。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_saying_random', '一言（随机/每日/场景/此刻） - 想给你的应用、聊天机器人或是个人主页加上一句温度满满的文案？不论是清晨的第一声问候、深夜的心灵慰藉，还是每天雷打不动的打卡金句，这个接口都能轻松搞定。

## 功能概述
这是一个高度整合的一言接口。通过传入不同的 `mode` 参数，你可以无缝切换出多种截然不同的文案场景，并且支持按来源、分类及标签进行过滤筛分。

## 四种运行模式 (`mode`)
- **随机模式 (`random` 或不传)**：每次调用都在指定范围内随机挑选一条新鲜的语录。
- **每日一言 (`daily`)**：在选定范围内，同一天内请求将返回固定的同一条语录。非常适合用来做每日打卡、晨会推送或签到背景。
- **场景推荐 (`recommend`)**：配合 `scene` 参数，精准推送适合特定场景（如 `morning` 清晨、`night` 深夜）的应景文字。
- **此刻一言 (`moment`)**：接口会自动分析请求时的本地时间段，智能推荐当下最合时宜的温情语句。

## 使用须知
> [!NOTE]
> - **过滤参数**：`source`、`category` 和 `tag` 支持传入多个值，彼此之间使用英文逗号 `,` 或分号 `;` 分隔即可。
> - **场景绑定**：当且仅当 `mode=recommend` 时，`scene` 参数为必填项；在其他模式下，该参数会被自动忽略。
> - **请求示例（推荐）**：
>   - 随机一言：`GET /api/v1/saying/random`
>   - 每日一言：`GET /api/v1/saying/random?mode=daily`
>   - 场景推荐：`GET /api/v1/saying/random?mode=recommend&scene=night`
>   - 此刻一言：`GET /api/v1/saying/random?mode=moment`', 'general', 'https://uapis.cn/api/v1/saying/random?mode={{mode}}&scene={{scene}}&source={{source}}&category={{category}}&tag={{tag}}', 'GET', '{}', NULL, NULL, '[{"name":"mode","type":"string","required":false,"description":"运行模式。不传或 random 为随机一言；可选 daily、recommend、moment。"},{"name":"scene","type":"string","required":false,"description":"推荐场景。当 mode=recommend 时必填，例如 night、morning、work 等。请从[支持的场景列表](#enum-list)中选择。"},{"name":"source","type":"string","required":false,"description":"语料来源过滤。支持重复传参，或使用逗号/分号分隔多个值。请从[支持的来源列表](#enum-list)中选择。"},{"name":"category","type":"string","required":false,"description":"分类过滤。支持重复传参，或使用逗号/分号分隔多个值。请从[支持的分类列表](#enum-list)中选择。"},{"name":"tag","type":"string","required":false,"description":"标签过滤。支持重复传参，或使用逗号/分号分隔多个值。请从[支持的标签列表](#enum-list)中选择。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_saying', '一言 - 想在你的应用里每天展示一句不一样的话，给用户一点小小的惊喜吗？这个“一言”接口就是为此而生。

## 功能概述
每次调用，它都会从我们精心收集的、包含数千条诗词、动漫台词、名人名言的语料库中，随机返回一条。你可以用它来做网站首页的Slogan、应用的启动语，或者任何需要灵感点缀的地方。', 'general', 'https://uapis.cn/api/v1/saying', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_random_image', '随机图片 - 需要一张随机图片作为占位符或者背景吗？这个接口是你的不二之选。

## 功能概述
这是一个非常简单的接口，它会从我们庞大的图库和精选外部图床中随机挑选一张图片，然后通过 302 重定向让你直接访问到它。这使得它可以非常方便地直接用在 HTML 的 `<img>` 标签中。

你可以通过 `/api/v1/random/image?category=acg&type=4k` 这样的请求获取由UapiPro服务器提供的图片，也可以通过 `/api/v1/random/image?category=ai_drawing` 获取由外部图床精选的图片。

如果你不提供任何 category 参数，程序会从所有图片（包括本地的和URL的）中随机抽取一张（**全局随机图片不包含ikun和AI绘画**）。

> [!TIP]
> 如果你需要更精确地控制图片类型，请使用 `/image/random/{category}/{type}` 接口。

### 支持的主类别与子类别
- **acg**（二次元动漫）
    - pc
    - mb
- **外部图床精选/混合动漫**
  - **landscape**: 风景图。
  - **anime**: 混合了UapiPro服务器的acg和外部图床的general_anime分类下的图片。
  - **pc_wallpaper**: 电脑壁纸。
  - **mobile_wallpaper**: 手机壁纸。
  - **general_anime**: 动漫图。
  - **ai_drawing**: AI绘画。
- **其他分类**
  - **bq**（表情包/趣图）
    - eciyuan
    - ikun
    - xiongmao
    - waiguoren
    - maomao
  - **furry**（福瑞）
    - z4k
    - szs8k
    - s4k
    - 4k

> [!NOTE]
> 默认全局随机（未指定category参数）时，不会包含ikun和AI绘画（ai_drawing）类别的图片。
', 'general', 'https://uapis.cn/api/v1/random/image?category={{category}}&type={{type}}', 'GET', '{}', NULL, NULL, '[{"name":"category","type":"string","required":false,"description":"（可选）指定图片主类别。\n\n**支持的主类别：**\n- `acg`（二次元动漫，UapiPro服务器）\n- `landscape`（风景图，外部图床）\n- `anime`（混合动漫）\n- `pc_wallpaper`（电脑壁纸，外部图床）\n- `mobile_wallpaper`（手机壁纸，外部图床）\n- `general_anime`（动漫图，外部图床）\n- `ai_drawing`（AI绘画，"},{"name":"type","type":"string","required":false,"description":"（可选，仅UapiPro服务器图片支持）指定图片子类别。\n\n- **bq**: `xiongmao`, `waiguoren`, `maomao`, `ikun`, `eciyuan`\n- **acg**: `pc`, `mb`\n- **furry**: `z4k`, `szs8k`, `s4k`, `4k`\n\n> [!TIP]\n> 外部图床类别和 `anime` 混合类别不支持 `type` 参"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_random_string', '随机字符串 - 无论是需要生成一个安全的随机密码、一个唯一的Token，还是一个简单的随机ID，这个接口都能满足你。

## 功能概述
你可以精确地控制生成字符串的长度和字符集类型，非常灵活。

## 使用须知

> [!TIP]
> **字符集类型 `type` 详解**
> 你可以通过 `type` 参数精确控制生成的字符集：
> - **`numeric`**: 纯数字 (0-9)
> - **`lower`**: 纯小写字母 (a-z)
> - **`upper`**: 纯大写字母 (A-Z)
> - **`alpha`**: 大小写字母 (a-zA-Z)
> - **`alphanumeric`** (默认): 数字和大小写字母 (0-9a-zA-Z)
> - **`hex`**: 十六进制字符 (0-9a-f)', 'general', 'https://uapis.cn/api/v1/random/string?length={{length}}&type={{type}}', 'GET', '{}', NULL, NULL, '[{"name":"length","type":"number","required":false,"description":"你希望生成的字符串的长度。有效范围是 1 到 1024。"},{"name":"type","type":"string","required":false,"description":"指定构成字符串的字符类型。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_answerbook_ask', '答案之书 - 想要获得人生问题的神秘答案吗？答案之书API提供了一个神奇8球风格的问答服务，你可以提问并获得随机的神秘答案。

## 功能概述
通过向答案之书提问，你将获得一个充满智慧（或许）的随机答案。这个API支持通过查询参数或POST请求体两种方式提问。', 'general', 'https://uapis.cn/api/v1/answerbook/ask?question={{question}}', 'GET', '{}', NULL, NULL, '[{"name":"question","type":"string","required":true,"description":"你想要提问的问题。问题不能为空。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_answerbook_ask', '答案之书 (POST) - 通过POST请求向答案之书提问并获得神秘答案。

## 功能概述
与GET方式相同，但通过JSON请求体发送问题，适合在需要发送较长问题或希望避免URL编码问题的场景中使用。

## 请求体格式
请求体必须是有效的JSON格式，包含question字段。', 'general', 'https://uapis.cn/api/v1/answerbook/ask', 'POST', '{}', '{"question":"{{question}}"}', NULL, '[{"name":"question","type":"string","required":true,"description":"你想要提问的问题"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_social_bilibili_userinfo', '查询 B站用户 - 想在你的应用里集成B站用户资料展示？这个接口可以轻松获取用户的公开信息。

## 功能概述
通过一个用户的UID（那一串纯数字ID），你可以查询到该用户的昵称、性别、头像、等级、签名等一系列公开的基本信息。', 'general', 'https://uapis.cn/api/v1/social/bilibili/userinfo?uid={{uid}}', 'GET', '{}', NULL, NULL, '[{"name":"uid","type":"string","required":true,"description":"Bilibili用户的UID"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_social_qq_userinfo', '查询 QQ 信息 - 通过 QQ 号查询用户资料，返回头像、昵称、个性签名、等级和 VIP 信息。

## 功能概述
这个接口适合用在用户资料展示、头像卡片、账号绑定结果展示等场景。若用户把 QQ 等级设为隐藏，`qq_level` 会返回 `null`。

## 数据字段说明
- **基础信息**: 昵称、个性签名、头像、年龄、性别
- **联系信息**: QQ 邮箱、个性域名（QID）
- **等级信息**: QQ 等级、VIP 状态和等级
- **时间信息**: 注册时间、最后更新时间', 'general', 'https://uapis.cn/api/v1/social/qq/userinfo?qq={{qq}}', 'GET', '{}', NULL, NULL, '[{"name":"qq","type":"string","required":true,"description":"需要查询的QQ号"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_social_bilibili_archives', '查询 B站投稿 - 想要获取UP主的所有投稿视频？或者想在你的应用里展示创作者的作品集？这个接口能帮你轻松实现。

## 功能概述
通过用户的 `mid`（用户ID），你可以获取该UP主的投稿视频列表。接口支持关键词搜索、分页加载和多种排序方式，让你能够灵活地展示和分析创作者的内容。

## 参数说明
- **`mid` (用户ID)**: B站用户的mid，必填参数。
- **`keywords` (搜索关键词)**: 可选，用于在该UP主的投稿中搜索特定关键词。
- **`orderby` (排序方式)**: 
  - `pubdate`: 按最新发布排序（默认）
  - `views`: 按最多播放排序
- **`ps` (每页条数)**: 默认20条。
- **`pn` (页码)**: 默认1，用于分页。

## 响应体字段说明
- **`total` (总稿件数)**: UP主的投稿总数。
- **`page` (当前页码)**: 当前返回的页码。
- **`size` (每页数量)**: 每页返回的视频数量。
- **`videos` (视频列表)**: 包含当前页的所有视频信息：
  - `aid`: 视频的AV号
  - `bvid`: 视频的BV号
  - `title`: 视频标题
  - `cover`: 封面URL
  - `duration`: 时长（秒）
  - `play_count`: 播放量
  - `publish_time`: 发布时间戳
  - `create_time`: 创建时间戳
  - `state`: 视频状态
  - `is_ugc_pay`: 是否付费视频（0=免费，1=付费）
  - `is_interactive`: 是否为互动视频', 'general', 'https://uapis.cn/api/v1/social/bilibili/archives?mid={{mid}}&keywords={{keywords}}&orderby={{orderby}}&ps={{ps}}&pn={{pn}}', 'GET', '{}', NULL, NULL, '[{"name":"mid","type":"string","required":true,"description":"B站用户的mid（用户ID）"},{"name":"keywords","type":"string","required":false,"description":"搜索关键词，可为空"},{"name":"orderby","type":"string","required":false,"description":"排序方式。`pubdate`=最新发布，`views`=最多播放"},{"name":"ps","type":"string","required":false,"description":"每页条数，默认20"},{"name":"pn","type":"string","required":false,"description":"页码，默认1"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_social_bilibili_videoinfo', '查询 B站视频 - 想在你的应用里展示B站视频的详细信息吗？无论是封面、标题，还是播放量、UP主信息，这个接口都能一网打尽。

## 功能概述
通过提供视频的 `aid` 或 `bvid`，你可以获取到该视频的完整元数据，包括多P信息、UP主资料、数据统计等。

## 响应体字段说明
- **`copyright` (视频类型)**: `1` 代表原创，`2` 代表转载。
- **`owner` (UP主信息)**: 包含 `mid`, `name`, `face` 等UP主的基本资料。
- **`stat` (数据统计)**: 包含了播放、弹幕、评论、点赞、投币、收藏、分享等核心数据。
- **`pages` (分P列表)**: 这是一个数组，包含了视频的每一个分P的信息，即使是单P视频也会有一个元素。', 'general', 'https://uapis.cn/api/v1/social/bilibili/videoinfo?aid={{aid}}&bvid={{bvid}}', 'GET', '{}', NULL, NULL, '[{"name":"aid","type":"string","required":false,"description":"视频的AV号 (aid)，纯数字格式。`aid`和`bvid`任选其一即可。"},{"name":"bvid","type":"string","required":false,"description":"视频的BV号 (bvid)，例如 `BV117411r7R1`。`aid`和`bvid`任选其一即可。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_social_bilibili_replies', '查询 B站评论 - 想要分析B站视频的评论区？这个接口可以帮你轻松获取评论数据，包括热门评论和最新评论，还支持分页加载。

## 功能概述
通过视频的 `oid`（通常就是视频的`aid`），你可以分页获取该视频的评论区内容。你可以指定排序方式和分页参数，来精确地获取你需要的数据。

## 参数说明
- **`sort` (排序方式)**
  - `0` 或 `time`：按时间排序
  - `1` 或 `like`：按点赞排序
  - `2` 或 `reply`：按回复数排序
  - `3` 或 `hot`（也支持 `hottest`、`最热`）：按最热排序

## 响应体字段说明
- **`hots` (热门评论)**: 仅在请求第一页时，可能会返回热门评论列表。其结构与 `replies` 中的对象一致。
- **`replies` (评论列表)**: 这是一个数组，包含了当前页的评论。其中：
  - `root`: 指向根评论的ID。如果评论本身就是根评论，则为 `0`。
  - `parent`: 指向该条回复所回复的上一级评论ID。如果评论是根评论，则为 `0`。', 'general', 'https://uapis.cn/api/v1/social/bilibili/replies?oid={{oid}}&sort={{sort}}&ps={{ps}}&pn={{pn}}', 'GET', '{}', NULL, NULL, '[{"name":"oid","type":"string","required":true,"description":"目标评论区的ID。对于视频，这通常就是它的 `aid`。"},{"name":"sort","type":"string","required":false,"description":"排序方式。支持 `0/time`（按时间）、`1/like`（按点赞）、`2/reply`（按回复数）、`3/hot/hottest/最热`（按最热）。默认为 `0/time`。"},{"name":"ps","type":"string","required":false,"description":"每页获取的评论数量，范围是1到20。默认为 `20`。"},{"name":"pn","type":"string","required":false,"description":"要获取的页码，从1开始。默认为 `1`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_social_bilibili_liveroom', '查询 B站直播间 - 想知道你喜欢的主播开播了吗？或者想在你的应用里集成B站直播间状态？这个接口能满足你。

## 功能概述
这是一个智能接口，你可以用主播的 `mid` (用户ID) 或者直播间的 `room_id` (长号或短号)来查询。它会返回直播间的详细信息，包括是否在直播、标题、封面、人气、分区等。

## 响应体字段说明
- **`live_status` (直播状态)**: `0` 代表未开播，`1` 代表直播中，`2` 代表轮播中。', 'general', 'https://uapis.cn/api/v1/social/bilibili/liveroom?mid={{mid}}&room_id={{room_id}}', 'GET', '{}', NULL, NULL, '[{"name":"mid","type":"string","required":false,"description":"主播的用户ID (`mid`)。与 `room_id` 任选其一。"},{"name":"room_id","type":"string","required":false,"description":"直播间ID，可以是长号（真实ID）或短号（靓号）。与 `mid` 任选其一。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_social_qq_groupinfo', '查询 QQ 群信息 - 想在你的应用里展示QQ群信息？这个接口让你轻松获取群名称、群头像、群简介、成员数量等详细公开信息。

## 功能概述
你只需要提供一个QQ群号（5-12位纯数字），接口就会返回该群的完整公开信息。我们会先验证群号的有效性，确保返回的数据准确可靠。接口响应速度快，数据结构清晰，非常适合集成到各类应用场景中。

## 返回数据说明
接口会返回以下QQ群的关键信息：

### 基础字段（所有群都有）
- **群基础信息**: 包括群号、群名称，让你能够准确识别和展示群聊
- **视觉素材**: 提供群头像URL（支持多种尺寸），可直接用于在你的界面中展示群聊图标
- **群介绍资料**: 包含群描述/简介和群标签，帮助用户了解群聊的主题和特色
- **便捷入口**: 返回加群链接（二维码URL），方便用户一键加入感兴趣的群聊
- **成员统计**: 当前成员数和最大成员数，直观了解群规模
- **数据时效**: 提供最后更新时间戳，让你了解数据的新鲜度

### 扩展字段（部分群有）
- **活跃度**: 活跃成员数量（可选）
- **群主信息**: 群主QQ号和UID（可选）
- **时间信息**: 建群时间戳和格式化时间（可选）
- **群等级**: 群等级数值（可选）
- **群公告**: 群公告/简介内容（可选）
- **认证信息**: 官方认证类型和说明（可选）

所有返回的数据都遵循标准的JSON格式，字段命名清晰，便于解析和使用。扩展字段仅在数据可用时返回，保持响应体精简。', 'general', 'https://uapis.cn/api/v1/social/qq/groupinfo?group_id={{group_id}}', 'GET', '{}', NULL, NULL, '[{"name":"group_id","type":"string","required":true,"description":"QQ群号，长度5-12位"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_github_repo', '查询 GitHub 仓库 - 需要快速获取一个GitHub仓库的核心信息？这个接口一次请求就能返回仓库的关键数据，适合项目展示、统计和分析场景。

### 可获取的数据
一次请求，即可获得以下信息：
- **核心指标**: `star`, `fork`, `open_issues` 等关键统计数据。
- **项目详情**: 描述、主页、分支、语言、话题标签、开源协议。
- **参与者信息**: 获取协作者(`collaborators`)和维护者参考信息(`maintainers`)列表，包括他们的公开邮箱（如果可用）。

> [!NOTE]
> `collaborators` 字段在私有仓库或权限受限时可能为空。`maintainers` 为整理后的参考信息，仅供参考。', 'general', 'https://uapis.cn/api/v1/github/repo?repo={{repo}}', 'GET', '{}', NULL, NULL, '[{"name":"repo","type":"string","required":true,"description":"目标仓库的标识，格式为 `owner/repo`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_github_user', '查询 GitHub 用户信息 - 需要获取开发者的 GitHub 画像？这个接口不仅能返回详尽的基础资料和所属的公开组织列表，还能一键拉取开发者的绿格子数据。

## 功能概述
- **开发者基础画像**：返回用户的仓库数、关注数、公司、地理位置和社交媒体链接等，非常适合用来自动生成技术博客的作者名片或建立开发者档案。
- **贡献日历与时间线**：只要开启 `activity=true`，就能获取该用户最近一年的全量贡献数据。返回的 JSON 已经将数据按周（weeks）和天（days）整理好，前端通过简单的双重循环就能画出和 GitHub 主页一模一样的贡献日历。
- **组织级贡献过滤**：如果你只想评估某个人在特定团队开源项目中的活跃度，直接传入 `org` 参数。接口会自动剥离他在其他私有项目或个人仓库的提交，只返回针对该组织的贡献数据。', 'general', 'https://uapis.cn/api/v1/github/user?user={{user}}&activity={{activity}}&activity_scope={{activity_scope}}&org={{org}}&pinned={{pinned}}&repos={{repos}}&repos_limit={{repos_limit}}', 'GET', '{}', NULL, NULL, '[{"name":"user","type":"string","required":true,"description":"GitHub 用户名（必需符合 GitHub 命名规范：仅限字母、数字、连字符，最长 39 位）。"},{"name":"activity","type":"boolean","required":false,"description":"是否获取最近一年的贡献活动数据（如贡献图、时间线）。传入 true 开启，其他值均视为不开启。"},{"name":"activity_scope","type":"string","required":false,"description":"活动数据范围。可选 all 或 organization。只有开启 activity 时才有意义。"},{"name":"org","type":"string","required":false,"description":"组织登录名。如果传入此参数，会自动视为开启 organization 级别的贡献查询，切勿再同时传 activity_scope=all。"},{"name":"pinned","type":"boolean","required":false,"description":"是否附带该用户在 GitHub 主页展示的 pinned 仓库数据。传入 true 开启，其他值均视为不开启。"},{"name":"repos","type":"boolean","required":false,"description":"是否附带该用户最近活跃的公开仓库列表。传入 true 开启，其他值均视为不开启。"},{"name":"repos_limit","type":"number","required":false,"description":"公开仓库列表的返回数量。只有开启 repos 时才有意义；如果单独传入 repos_limit，也会自动视为开启 repos。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_status_ratelimit', '限流状态 - 想了解当前服务的运行状态吗？这个接口可以返回关键监控指标。

## 功能概述
此接口用于查看当前服务状态，包括并发请求数、当前限制值、系统负载等信息，适合管理员排查运行情况。

> [!IMPORTANT]
> 此接口为管理接口，需要提供有效的管理员级别API密钥才能访问。

### 认证方式
请在请求头中添加 `Authorization: Bearer <你的API密钥>`。', 'general', 'https://uapis.cn/api/v1/status/ratelimit', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_status_usage', '获取API端点使用统计 - 想知道哪个API接口最受欢迎吗？这个接口提供了详细的“账单”。

## 功能概述
此接口用于获取每个API端点（Endpoint）的使用情况统计。你可以查询所有端点的列表，也可以通过 `path` 参数指定查询某一个特定端点。返回信息包括调用次数和平均处理时长', 'general', 'https://uapis.cn/api/v1/status/usage?path={{path}}', 'GET', '{}', NULL, NULL, '[{"name":"path","type":"string","required":false,"description":"（可选）如果你想查询某个特定的端点，请提供它的路径，例如 ''''/api/v1/image/motou''''。如果留空，则返回所有端点的统计列表。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_aes_decrypt', 'AES 解密 - 收到了用AES加密的密文？把它、密钥和随机数（nonce）交给我们，就能还原出原始内容。

## 功能概述
这是一个标准的AES解密接口。你需要提供经过Base64编码的密文、加密时使用的密钥和nonce（随机数，通常为16字节字符串）。

> [!IMPORTANT]
> **关于密钥 `key`**
> 我们支持 AES-128, AES-192, 和 AES-256。请确保你提供的密钥 `key` 的长度（字节数）正好是 **16**、**24** 或 **32**，以分别对应这三种加密强度。
> 
> **关于随机数 `nonce`**
> 通常为16字节字符串，需与加密时一致。', 'general', 'https://uapis.cn/api/v1/text/aes/decrypt', 'POST', '{}', '{"key":"{{key}}","text":"{{text}}","nonce":"{{nonce}}"}', NULL, '[{"name":"key","type":"string","required":true,"description":"密钥，长度必须为16、24或32字节，对应AES-128/192/256。"},{"name":"text","type":"string","required":true,"description":"Base64编码的密文。"},{"name":"nonce","type":"string","required":false,"description":"16字节的IV/Nonce，必须为16个字符"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_aes_encrypt', 'AES 加密 - 需要安全地传输或存储一些文本信息？AES加密是一个可靠的选择。

## 功能概述
这是一个标准的AES加密接口。你提供需要加密的明文和密钥，我们返回经过Base64编码的密文。

> [!IMPORTANT]
> **关于密钥 `key`**
> 我们支持 AES-128, AES-192, 和 AES-256。请确保你提供的密钥 `key` 的长度（字节数）正好是 **16**、**24** 或 **32**，以分别对应这三种加密强度。', 'general', 'https://uapis.cn/api/v1/text/aes/encrypt', 'POST', '{}', '{"key":"{{key}}","text":"{{text}}"}', NULL, '[{"name":"key","type":"string","required":true,"description":"密钥长度必须为 16、24 或 32 字节，分别对应 AES-128、AES-192、AES-256。"},{"name":"text","type":"string","required":true,"description":"待加密的明文文本。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_analyze', '文本分析 - 想知道一篇文章有多少字、多少个词、或者多少行？这个接口可以帮你快速统计。

## 功能概述
你提供一段文本，我们会从多个维度进行分析，并返回其字符数、词数、句子数、段落数和行数。这对于文本编辑、内容管理等场景非常有用。', 'general', 'https://uapis.cn/api/v1/text/analyze', 'POST', '{}', '{"text":"{{text}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":""}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_base64_decode', 'Base64 解码 - 这是一个简单实用的 Base64 解码工具。

## 功能概述
你提供一个 Base64 编码的字符串，我们帮你解码成原始的 UTF-8 文本。', 'general', 'https://uapis.cn/api/v1/text/base64/decode', 'POST', '{}', '{"text":"{{text}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":""}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_base64_encode', 'Base64 编码 - 这是一个简单实用的 Base64 编码工具。

## 功能概述
你提供一段原始文本，我们帮你转换成 Base64 编码的字符串。', 'general', 'https://uapis.cn/api/v1/text/base64/encode', 'POST', '{}', '{"text":"{{text}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":""}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_text_md5', 'MD5 哈希 - 一个快速计算文本 MD5 哈希值的工具，适用于短文本且不关心参数暴露的场景。

## 功能概述
通过GET请求的查询参数传入文本，返回其32位小写的MD5哈希值。

> [!NOTE]
> 对于较长或敏感的文本，我们推荐使用本接口的 POST 版本，以避免URL长度限制和参数暴露问题。', 'general', 'https://uapis.cn/api/v1/text/md5?text={{text}}', 'GET', '{}', NULL, NULL, '[{"name":"text","type":"string","required":true,"description":"需要计算哈希值的文本"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_md5', 'MD5 哈希 (POST) - 一个用于计算文本 MD5 哈希值的标准工具，推荐使用此版本。

## 功能概述
通过POST请求的表单体传入文本，返回其32位小写的MD5哈希值。相比GET版本，此方法更适合处理较长或包含敏感信息的文本。', 'general', 'https://uapis.cn/api/v1/text/md5', 'POST', '{}', '{"text":"{{text}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":"需要计算哈希值的文本"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_md5_verify', 'MD5 校验 - 下载了一个文件，想确认它在传输过程中有没有损坏？校验MD5值是最常用的方法。

## 功能概述
你提供原始文本和一个MD5哈希值，我们帮你计算文本的哈希，并与你提供的哈希进行比对，告诉你它们是否匹配。这在文件完整性校验等场景下非常有用。', 'general', 'https://uapis.cn/api/v1/text/md5/verify', 'POST', '{}', '{"hash":"{{hash}}","text":"{{text}}"}', NULL, '[{"name":"hash","type":"string","required":true,"description":"用于比对的 MD5 哈希值（32 位小写十六进制字符串）。"},{"name":"text","type":"string","required":true,"description":"待校验的原始文本，会先计算其 MD5 再与 hash 进行比对。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_aes_encrypt_advanced', 'AES高级加密 - 需要更灵活的AES加密方案？这个高级接口支持6种加密模式和3种填充方式，让你根据具体场景选择最合适的加密配置。

> [!IMPORTANT]
> **推荐使用GCM模式**
> GCM模式提供认证加密(AEAD)，不仅能加密数据，还能验证数据完整性，防止密文被篡改。这是目前最推荐的加密模式。

## 功能概述
这是一个功能全面的AES加密接口，支持多种加密模式和填充方式。你可以根据不同的安全需求和性能要求，灵活选择合适的加密配置。

### 支持的加密模式
- **GCM模式**（推荐）：认证加密模式，提供完整性保护
- **CBC模式**：经典块加密模式，需要IV和填充，适用于文件加密
- **CTR模式**：流密码模式，无需填充，适用于实时数据加密
- **OFB/CFB模式**：流密码模式，无需填充，适用于流数据加密
- **ECB模式**（不推荐）：仅用于兼容性需求

### 支持的填充方式
- **PKCS7填充**（推荐）：标准填充方式
- **Zero填充**：使用0x00字节填充
- **None填充**：无填充，用于流密码模式

### 输出格式支持
- **base64**（默认）：标准Base64编码输出，适合传输和存储
- **hex**：十六进制编码输出，方便进行结果核对

通过 `output_format` 参数可以直接获取HEX格式的密文，无需额外调用转换接口。

## 参数说明
- **`text`**: 待加密的明文文本
- **`key`**: 加密密钥（支持任意长度）
- **`mode`**: 加密模式（可选，默认GCM）
- **`padding`**: 填充方式（可选，默认PKCS7）
- **`iv`**: 自定义IV（可选，Base64编码，16字节）
- **`output_format`**: 输出格式（可选，默认base64）

## 使用示例

**示例1：HEX格式输出**
```json
{
  "text": "测试文本123",
  "key": "1234567890123456",
  "mode": "ECB",
  "padding": "PKCS7",
  "output_format": "hex"
}
```
返回示例：
```json
{
  "ciphertex', 'general', 'https://uapis.cn/api/v1/text/aes/encrypt-advanced', 'POST', '{}', '{"text":"{{text}}","key":"{{key}}","mode":"{{mode}}","padding":"{{padding}}","iv":"{{iv}}","output_format":"{{output_format}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":"待加密的明文文本"},{"name":"key","type":"string","required":true,"description":"加密密钥（支持任意长度）"},{"name":"mode","type":"string","required":false,"description":"加密模式：GCM/CBC/ECB/CTR/OFB/CFB（可选，默认GCM）"},{"name":"padding","type":"string","required":false,"description":"填充方式：PKCS7/ZERO/NONE（可选，默认PKCS7）"},{"name":"iv","type":"string","required":false,"description":"自定义IV（可选，Base64编码，16字节）。GCM模式无需此参数"},{"name":"output_format","type":"string","required":false,"description":"输出格式：base64（默认）或hex"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_aes_decrypt_advanced', 'AES高级解密 - 需要解密通过高级加密接口加密的数据？这个接口提供与加密接口完全配对的解密功能，支持相同的6种加密模式和3种填充方式。

> [!IMPORTANT]
> **解密参数必须与加密时一致**
> 解密时，必须提供与加密时相同的密钥、模式和填充方式。对于非GCM模式，还需要提供加密时返回的IV。

## 功能概述
这是一个功能完整的AES解密接口，能够解密通过高级加密接口加密的所有密文。支持所有6种加密模式和3种填充方式，与加密接口完全配对。

### 解密流程
1. 获取加密时返回的密文和配置参数
2. 使用相同的密钥、模式、填充方式和IV（如需要）
3. 调用本接口进行解密
4. 获取原始明文

### 支持的解密模式
- **GCM模式**（推荐）：自动验证数据完整性，如果密文被篡改会解密失败
- **CBC模式**：经典块解密模式，需要提供加密时的IV
- **CTR/OFB/CFB模式**：流密码解密，需要提供加密时的IV
- **ECB模式**：不需要IV，但安全性较低

### 填充方式处理
- **PKCS7填充**：解密后自动移除填充
- **Zero填充**：解密后自动移除0x00填充
- **None填充**：无填充处理

## 参数说明
- **`text`**: 待解密的密文（Base64编码，来自加密接口返回的ciphertext字段）
- **`key`**: 解密密钥（必须与加密时相同）
- **`mode`**: 加密模式（必须与加密时相同）
- **`padding`**: 填充方式（可选，默认PKCS7，必须与加密时相同）
- **`iv`**: 初始化向量（非GCM模式必须提供，Base64编码）

## 常见错误处理
如果解密失败，请检查以下几点：
- 密钥是否与加密时完全相同
- 模式和填充方式是否匹配
- 非GCM模式下是否提供了正确的IV
- 密文是否完整且未被修改
- GCM模式下密文是否被篡改', 'general', 'https://uapis.cn/api/v1/text/aes/decrypt-advanced', 'POST', '{}', '{"text":"{{text}}","key":"{{key}}","mode":"{{mode}}","padding":"{{padding}}","iv":"{{iv}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":"待解密的密文（Base64编码）。此值来自加密接口返回的ciphertext字段"},{"name":"key","type":"string","required":true,"description":"解密密钥（必须与加密时相同）"},{"name":"mode","type":"string","required":true,"description":"加密模式（必须与加密时相同）：GCM/CBC/ECB/CTR/OFB/CFB"},{"name":"padding","type":"string","required":false,"description":"填充方式（可选，必须与加密时相同）：PKCS7/ZERO/NONE。GCM模式默认为NONE"},{"name":"iv","type":"string","required":false,"description":"初始化向量（非GCM模式必须提供，Base64编码）。此值来自加密接口返回的iv字段"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_markdown_to_html', 'Markdown 转 HTML - 直接调用这个接口，就可以把 Markdown 文本转换成带样式的 HTML，而且它不只适合程序里动态注入，也适合在开发阶段直接预览。

## 如何使用与预览
- **默认模式：返回 JSON 里的 HTML 片段**：不传 `format` 时，接口会返回 JSON。您只需要读取响应里的 `data.html`，再赋值给前端容器，例如 `element.innerHTML = data.html`、Vue 的 `v-html`，或者 React 里配合 `dangerouslySetInnerHTML` 使用。
- **预览模式：直接返回完整 HTML 网页**：如果您想在浏览器里直接打开结果，或者想把响应保存成一个独立的 `.html` 文件，请传 `format="html"`。这个模式下，接口会直接返回带 `<!DOCTYPE html><html>...` 的完整网页源码。

## 功能概述
- **自带精美排版，无需手写 CSS**：返回结果已经内置样式，标题、引用、表格、任务列表和代码块都可以直接显示。
- **支持丰富的排版元素**：除了标准 Markdown，这个接口也可以正确处理 GFM 常见语法，例如表格、任务列表和带语言标记的代码块。
- **安全处理用户内容**：默认开启安全模式，会自动过滤原始 HTML 里的风险脚本。如果内容来源绝对可信，并且您确实需要保留原始 HTML，可以把 `sanitize` 设为 `false`。', 'general', 'https://uapis.cn/api/v1/text/markdown-to-html', 'POST', '{}', '{"text":"{{text}}","format":"{{format}}","sanitize":"{{sanitize}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":"原始 Markdown 字符串，最大不超过 1MB。"},{"name":"format","type":"string","required":false,"description":"响应格式。传 `json` 时返回 JSON 包裹的 HTML 片段；传 `html` 时直接返回 `text/html`，并且响应内容会自动带完整的网页结构，适合浏览器预览或直接保存为网页文件。默认是 `json`。"},{"name":"sanitize","type":"boolean","required":false,"description":"是否开启安全模式，过滤掉用户输入中的风险脚本。默认是 `true`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_markdown_to_pdf', 'Markdown 转 PDF - 当您的业务系统需要提供“导出为 PDF”的功能时，无需在后端部署复杂的排版引擎，只需将 Markdown 文本发给这个接口，即可直接获取打印级的 PDF 文件。

## 功能概述
- **服务端直接生成**：接口直接返回 PDF 文件二进制流，前端无需任何处理即可触发下载，后端也能轻松存盘归档。
- **多种精美主题与纸张**：内置了 GitHub、暗黑等多种专业排版主题，并支持 A4、Letter 等标准纸张。只需简单配置，就能生成符合业务场景的专业文档。
- **公网图片也可以直接带入 PDF**：除了纯文本和标准 Markdown 语法，这个接口也可以处理 `data URI` 图片，或者公网可访问的 `http`、`https` 图片链接。服务端会先通过代理抓取图片，并在渲染前内联到文档里，同时带有超时控制。', 'general', 'https://uapis.cn/api/v1/text/markdown-to-pdf', 'POST', '{}', '{"text":"{{text}}","theme":"{{theme}}","paper_size":"{{paper_size}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":"原始 Markdown 字符串，最大不超过 1MB。"},{"name":"theme","type":"string","required":false,"description":"PDF 的排版主题。可选 `github`、`minimal`、`light`、`dark`，默认是 `github`。"},{"name":"paper_size","type":"string","required":false,"description":"PDF 的纸张大小。可选 `A4` 或 `Letter`，默认是 `A4`。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_text_convert', '格式转换 - 需要在不同文本格式之间转换？这个接口支持Base64、Hex、URL、HTML、Unicode等多种格式互转，还能生成MD5、SHA256等哈希值。

## 功能概述
你提供待转换的文本、源格式和目标格式，接口会自动完成转换。支持7种双向格式（plain、base64、hex、url、html、unicode、binary）和4种单向哈希（md5、sha1、sha256、sha512）。

## 格式说明
**双向转换格式**：plain（纯文本）、base64、hex（十六进制）、url、html（HTML实体）、unicode（\uXXXX转义）、binary（二进制字符串）

**单向哈希格式**：md5、sha1、sha256、sha512（仅可作为目标格式，不可逆）

## 链式转换
支持多次调用实现复杂转换，如先将文本转为base64，再将base64转为hex。', 'general', 'https://uapis.cn/api/v1/text/convert', 'POST', '{}', '{"text":"{{text}}","from":"{{from}}","to":"{{to}}","options":"{{options}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":"待转换的文本内容"},{"name":"from","type":"string","required":true,"description":"源格式类型"},{"name":"to","type":"string","required":true,"description":"目标格式类型"},{"name":"options","type":"object","required":false,"description":"可选参数（预留，当前未使用）"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_translate_text', '翻译 - 需要跨越语言的鸿沟进行交流？这个翻译接口是你可靠的''同声传译''。

## 功能概述
你可以将一段源语言文本（我们能自动检测源语言）翻译成你指定的任何目标语言。无论是中译英、日译法，都不在话下。

## 支持的语言
我们支持超过100种语言的互译，包括但不限于：中文（简体/繁体）、英语、日语、韩语、法语、德语、西班牙语、俄语、阿拉伯语等主流语言，以及各种小语种。详见下方参数列表。', 'general', 'https://uapis.cn/api/v1/translate/text', 'POST', '{}', '{"text":"{{text}}"}', NULL, '[{"name":"to_lang","type":"string","required":true,"description":"目标语言代码。请从[支持的语言列表](#enum-list)中选择一个语言代码。"},{"name":"text","type":"string","required":true,"description":"待翻译的文本内容，最大长度3000字符。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_ai_translate', 'AI智能翻译 - 这是一个高质量的智能翻译服务，支持多种翻译风格和专业场景，适合对译文质量有更高要求的业务场景。

## 功能概述

- **单文本翻译**: 专注处理单条文本翻译，适合需要高质量译文的业务场景。
- **多风格适配**: 提供随意口语化、专业商务、学术正式、文学艺术四种翻译风格，能够根据不同场景需求调整翻译的语言风格和表达方式。
- **上下文感知**: 支持通用、商务、技术、医疗、法律、市场营销、娱乐、教育、新闻等九种专业领域的上下文翻译，确保术语准确性和表达地道性。
- **格式保留**: 智能识别并保持原文的格式结构，包括换行、缩进、特殊符号等，确保翻译后的文本保持良好的可读性。

## 支持的语言

我们支持超过100种语言的互译，详见下方参数列表。', 'general', 'https://uapis.cn/api/v1/ai/translate', 'POST', '{}', '{"text":"{{text}}","source_lang":"{{source_lang}}","style":"{{style}}","context":"{{context}}","preserve_format":"{{preserve_format}}"}', NULL, '[{"name":"target_lang","type":"string","required":true,"description":"目标语言代码。请从[支持的语言列表](#enum-list)中选择一个语言代码。"},{"name":"text","type":"string","required":true,"description":"待翻译的文本内容。最大长度10,000字符。"},{"name":"source_lang","type":"string","required":false,"description":"源语言代码，可选。如果不指定，系统会自动检测源语言。"},{"name":"style","type":"string","required":false,"description":"翻译风格，可选。支持casual(随意口语化)、professional(专业商务，默认)、academic(学术正式)、literary(文学艺术)。"},{"name":"context","type":"string","required":false,"description":"翻译上下文场景，可选。支持general(通用，默认)、business(商务)、technical(技术)、medical(医疗)、legal(法律)、marketing(市场营销)、entertainment(娱乐)、education(教育)、news(新闻)。"},{"name":"preserve_format","type":"boolean","required":false,"description":"是否保留原文格式，包括换行、缩进等。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_ai_translate_languages', 'AI翻译配置 - 获取AI智能翻译服务支持的完整语言列表、翻译风格选项、上下文场景选项以及性能指标信息。', 'general', 'https://uapis.cn/api/v1/ai/translate/languages', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_translate_stream', '流式翻译（中英互译） - 想让翻译结果像打字机一样逐字显示出来？这个流式翻译接口能实现这种效果。

## 功能概述
不同于传统翻译API一次性返回完整结果，这个接口会实时地、一个字一个字地把翻译内容推给你（就像ChatGPT回复消息那样），非常适合用在聊天应用、直播字幕等需要即时反馈的场景。

## 它能做什么
- **中英互译**：支持中文和英文之间的双向翻译
- **自动识别**：不确定源语言？设置为 `auto` 让我们自动检测
- **逐字返回**：翻译结果会像打字机一样逐字流式返回，用户体验更流畅
- **音频朗读**：部分翻译结果会附带音频链接，方便朗读

## 支持的语言
目前专注于中英互译，支持以下选项：
- `中文`（简体/繁体）
- `英文`
- `auto`（自动检测）', 'general', 'https://uapis.cn/api/v1/translate/stream', 'POST', '{}', '{"query":"{{query}}","to_lang":"{{to_lang}}","from_lang":"{{from_lang}}","tone":"{{tone}}"}', NULL, '[{"name":"query","type":"string","required":true,"description":"待翻译的文本内容"},{"name":"to_lang","type":"string","required":true,"description":"目标语言，支持：中文、英文"},{"name":"from_lang","type":"string","required":false,"description":"源语言，支持：中文、英文、auto（自动检测）。默认为auto"},{"name":"tone","type":"string","required":false,"description":"语气参数，可选"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_webparse_extractimages', '提取网页图片 - 想批量获取一个网页上的所有图片链接？这个接口帮你搞定。

## 功能概述
提供一个网页 URL，返回该页面中所有图片的链接列表。适合用于图片采集、素材下载等场景。', 'general', 'https://uapis.cn/api/v1/webparse/extractimages?url={{url}}', 'GET', '{}', NULL, NULL, '[{"name":"url","type":"string","required":true,"description":"需要提取图片的网页URL"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_webparse_metadata', '提取网页元数据 - 想在应用里做链接预览卡片？这个接口帮你一键获取网页的标题、描述、图标等信息。

## 功能概述
提供一个网页 URL，返回该页面的元数据，包括标题、描述、关键词、Favicon、Open Graph 信息等。非常适合用于生成链接预览卡片或做 SEO 分析。', 'general', 'https://uapis.cn/api/v1/webparse/metadata?url={{url}}', 'GET', '{}', NULL, NULL, '[{"name":"url","type":"string","required":true,"description":"需要提取元数据的网页URL"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_web_tomarkdown_async', '网页转 Markdown - 想把一个网页的内容转成干净的 Markdown 文本？这个异步接口可以帮你搞定，特别适合处理大型或复杂的网页。

## 功能概述

提交一个网页 URL，我们会自动抓取主体内容，剔除广告、导航栏等干扰元素，并转换为 Markdown 格式。同时会提取标题、作者、发布日期等元数据，生成 YAML Front Matter。

任务提交后会立即返回任务 ID，你可以用它来查询处理进度和结果。单个任务最长处理 60 秒，结果缓存 30 分钟。', 'general', 'https://uapis.cn/api/v1/web/tomarkdown/async', 'POST', '{}', NULL, NULL, '[{"name":"url","type":"string","required":true,"description":"需要转换的网页URL。URL必须经过编码。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_web_tomarkdown_async_status', '转换任务状态 - 提交了网页转 Markdown 任务后，想知道处理进度和结果？用这个接口来查询。

## 功能概述
通过任务 ID 查询转换任务的当前状态、处理进度和最终结果。任务结果缓存 30 分钟，期间可重复查询。

## 任务状态

| 状态 | 说明 |
|------|------|
| `pending` | 等待处理 |
| `processing` | 处理中 |
| `completed` | 已完成，可获取结果 |
| `failed` | 失败 |
| `timeout` | 超时（超过 60 秒） |

> [!NOTE]
> 建议每 2-5 秒轮询一次，当状态为 `completed`、`failed` 或 `timeout` 时停止轮询。', 'general', 'https://uapis.cn/api/v1/web/tomarkdown/async/{{task_id}}', 'GET', '{}', NULL, NULL, '[{"name":"task_id","type":"string","required":true,"description":"任务ID（由提交接口返回）"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_clipzy_store', '步骤1：上传加密数据 - 这是所有流程的第一步。您的客户端应用需要先在本地准备好 **加密后的数据**，然后调用此接口进行上传。成功后，您会得到一个用于后续操作的唯一ID。

> [!NOTE]
> 您发送给此接口的应该是**密文**，而不是原始文本。请参考文档首页的JavaScript示例来了解如何在客户端进行加密。', 'general', 'https://uapis.cn/api/v1/api/store', 'POST', '{}', '{"compressedData":"{{compressedData}}","ttl":"{{ttl}}"}', NULL, '[{"name":"compressedData","type":"string","required":true,"description":"必需：经过加密和 LZString 压缩后的 Base64 字符串。请参考文档首页的JS代码示例。"},{"name":"ttl","type":"number","required":false,"description":"可选：片段的留存时间（秒）。正数表示秒数（最大约30天），-1 表示永久存储。默认为 3600。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_clipzy_get', '步骤2 (方法一): 获取加密数据 - **此接口用于“最高安全等级”方法。**

您提供第一步中获得的ID，它会返回存储在服务器上的**加密数据**。您需要在自己的客户端中，使用您自己保管的密钥来解密它。', 'general', 'https://uapis.cn/api/v1/api/get?id={{id}}', 'GET', '{}', NULL, NULL, '[{"name":"id","type":"string","required":true,"description":"片段的唯一 ID。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_clipzy_raw', '步骤2 (方法二): 获取原始文本 - **此接口用于“方便自动化”方法。**

您提供第一步获得的ID，并附上您自己保管的**解密密钥**作为 `key` 参数。服务器会直接为您解密，并返回纯文本内容。

> [!IMPORTANT]
> 查看文档首页的 **cURL 示例**，了解此接口最典型的用法。', 'general', 'https://uapis.cn/api/v1/api/raw/{{id}}?key={{key}}', 'GET', '{}', NULL, NULL, '[{"name":"id","type":"string","required":true,"description":"片段的唯一 ID。"},{"name":"key","type":"string","required":true,"description":"用于解密的 Base64 编码的 AES 密钥。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_search_aggregate', '智能搜索 - 想在你的应用中集成搜索功能？这个接口可以帮你轻松实现实时网页搜索。

## 功能概述

UAPI Pro Search 可以根据查询内容返回更相关的搜索结果。你可以用它搜索任何关键词，也可以限定在特定网站或特定文件类型中搜索。

- **实时网页搜索**: 毫秒级响应，快速返回搜索结果
- **智能排序**: 根据查询内容返回更相关的结果
- **时间排序**: 支持按发布时间排序，获取最新内容
- **时间范围过滤**: 支持按天/周/月/年过滤结果
- **站内搜索**: 支持 `site:` 操作符，在指定网站内搜索
- **文件类型过滤**: 支持 `filetype:` 操作符，快速找到 PDF、Word 等特定格式文件
      ', 'general', 'https://uapis.cn/api/v1/search/aggregate', 'POST', '{}', '{"query":"{{query}}","site":"{{site}}","filetype":"{{filetype}}","fetch_full":"{{fetch_full}}","sort":"{{sort}}","time_range":"{{time_range}}"}', NULL, '[{"name":"query","type":"string","required":true,"description":"搜索查询关键词，支持中英文"},{"name":"site","type":"string","required":false,"description":"限制搜索特定网站，不需要 `site:` 前缀"},{"name":"filetype","type":"string","required":false,"description":"限制文件类型，不需要 `filetype:` 前缀。支持 pdf、doc、docx、ppt、pptx、xls、xlsx、txt 等"},{"name":"fetch_full","type":"boolean","required":false,"description":"是否获取页面完整正文（会影响响应时间）"},{"name":"sort","type":"string","required":false,"description":"排序方式"},{"name":"time_range","type":"string","required":false,"description":"时间范围过滤"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_search_engines', '搜索引擎配置 - 获取搜索功能的详细信息，包括支持的能力、参数限制和使用说明。

## 功能概述

此接口返回搜索功能的完整配置信息，你可以用它来：
- 了解当前可用的搜索能力（如站内搜索、文件类型过滤等）
- 获取参数的默认值和限制范围
- 查看当前配置版本和可用状态

适合在应用初始化时调用，或用于动态配置搜索界面。
      ', 'general', 'https://uapis.cn/api/v1/search/engines', 'GET', '{}', NULL, NULL, '[]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_sensitive_word_analyze', '分析敏感词 - 分析单个或多个关键词的敏感程度，返回标准化风险标签与置信度结果。

## 功能概述

- **风险分析**: 结合文本内容给出语义层面的风险判断。
- **响应稳定**: 兼顾高频调用场景下的处理效率和响应速度。
- **并发支持**: 支持批量并发处理，单次最多可分析100个关键词。
- **输入限制**: 单条关键词最多 1,000 字符，总字符数最多 20,000。
- **标准标签**: 返回 `label` 字段，明确区分 `sensitive` 与 `normal`。
- **分类清晰**: 返回 `category` 字段，用于标识具体风险类别。
- **置信度输出**: 返回 `confidence` 字段，范围为0.0到1.0。

## 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `results` | array | 分析结果对象的数组。 |
| `results[].k` | string | 您在请求中提供的原始关键词。 |
| `results[].label` | string | 核心判断字段：`sensitive`(敏感)、`normal`(正常)。 |
| `results[].category` | string | 风险分类：`safe`(安全)、`threat`(威胁)、`porn`(色情)、`fraud`(欺诈)、`insult`(辱骂)。 |
| `results[].confidence` | number | 当前分类的置信度，范围0.0到1.0。 |
| `total` | integer | 本次请求成功分析的关键词总数。 |
      ', 'general', 'https://uapis.cn/api/v1/sensitive-word/analyze', 'POST', '{}', '{"keywords":"{{keywords}}"}', NULL, '[{"name":"keywords","type":"array","required":true,"description":"要分析的关键词列表，单次最多100个。单条关键词最多1,000字符，总字符数最多20,000。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('get_sensitive_word_analyze_query', '敏感词分析 (GET) - 通过URL查询参数分析单个关键词，便于GET请求调用。', 'general', 'https://uapis.cn/api/v1/sensitive-word/analyze-query?keyword={{keyword}}', 'GET', '{}', NULL, NULL, '[{"name":"keyword","type":"string","required":true,"description":"要分析的关键词，最长1,000字符。"}]', 1);
INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('post_sensitive_word_quick_check', '敏感词检测（快速） - 在你的社区或应用中，需要过滤不适合展示的内容时，这个接口可以帮你快速完成检测。

## 功能概述

这个接口可以识别文本中的敏感词，并返回是否命中、命中词列表等结果，适合用于评论区、社区、论坛和内容发布场景。

### 主要特性

- **快速检测**：能够一次处理整段文本中的多个命中内容
- **简繁体支持**：支持简体中文、繁体中文和混合文本检测
- **结果直观**：返回清晰的检测结果，方便直接接入审核流程
- **响应稳定**：适合日常内容审核和批量检查场景

无论是论坛、社交平台还是评论系统，这个接口都能帮你快速构建内容审核功能。', 'general', 'https://uapis.cn/api/v1/text/profanitycheck', 'POST', '{}', '{"text":"{{text}}"}', NULL, '[{"name":"text","type":"string","required":true,"description":"需要检测的文本内容。支持简体和繁体中文。"}]', 1);