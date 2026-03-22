// const YOUTUBE_REFERER_RULE_ID = 1;

// chrome.runtime.onInstalled.addListener(() => {
//   const rules = [
//     {
//       id: YOUTUBE_REFERER_RULE_ID,
//       priority: 1,
//       action: {
//         type: "modifyHeaders",
//         requestHeaders: [
//           {
//             header: "referer",
//             operation: "set",
//             value: "https://www.youtube.com/", // You can also use your extension URL
//           },
//         ],
//       },
//       condition: {
//         urlFilter: "https://www.youtube.com/embed/*",
//         resourceTypes: ["sub_frame"],
//       },
//     },
//   ];

//   chrome.declarativeNetRequest.updateDynamicRules({
//     removeRuleIds: [YOUTUBE_REFERER_RULE_ID],
//     addRules: rules,
//   });
// });
// const YOUTUBE_RULE_ID = 1;

// chrome.runtime.onInstalled.addListener(() => {
//   const rules = [
//     {
//       id: YOUTUBE_RULE_ID,
//       priority: 1,
//       action: {
//         type: "modifyHeaders",
//         requestHeaders: [
//           {
//             header: "Referer",
//             operation: "set",
//             value: "*://*.youtube.com/*",
//           },
//           {
//             header: "Origin",
//             operation: "set",
//             value: "*://*.youtube.com/*",
//           },
//         ],
//       },
//       condition: {
//         // Broaden the filter to catch internal API calls the player makes
//         urlFilter: "*://*.youtube.com/*",
//         resourceTypes: ["sub_frame", "xmlhttprequest", "other"],
//       },
//     },
//   ];

//   chrome.declarativeNetRequest.updateDynamicRules({
//     removeRuleIds: [YOUTUBE_RULE_ID],
//     addRules: rules,
//   });
// });
