import useSWR from "swr";
import _ from "lodash";
import React from "react";
import { Time } from "../../components/time";
import { PaginatedSearchResults } from "../../components/search-results";
import { ExternalLink } from "../../components/external-link";
import domPurify from "dompurify";
import { Card } from "@blueprintjs/core";
import logo from "./logo.svg";
import EmojiJS from "emoji-js";

const pageSize = 5;

const emojiConverter = new EmojiJS();
const rx_colons = new RegExp(":([a-zA-Z0-9-_+]+):", "g");

domPurify.addHook("afterSanitizeAttributes", (node) => {
  if ("target" in node) {
    node.setAttribute("target", "_blank");
  }
});

function slackMessageParser(message, usersById, emojis) {
  if (!message?.text) {
    return "";
  }

  const urlRegex = /<http(.*?)>/gm;
  const userRegex = /<@([A-Z0-9]+)>/gm;

  let a = message.text
    .replace(rx_colons, (match, p1) => {
      if (!emojis[p1]) {
        return match;
      }
      return `<img src="${emojis[p1]}" style="width:1rem;height:1rem;" alt="emoji"/>`;
    })
    .replace(urlRegex, `<a href="http$1">http$1</a>`)
    .replace(userRegex, (match, p1) => {
      const linkToUser = `slack://user?id=${p1}&team=${message.team}`;
      return `<a href="${linkToUser}" >@${_.get(usersById, [p1, "real_name"], p1)}</a>`;
    });

  return emojiConverter.replace_colons(a);
}

async function getUsers(token) {
  const res = await fetch(`https://slack.com/api/users.list?token=${token}`);
  return res.json();
}

async function getEmojis(token) {
  const res = await fetch(`https://slack.com/api/emoji.list?token=${token}`);
  return res.json();
}

const getUsersMemo = _.memoize(getUsers);
const getEmojisMemo = _.memoize(getEmojis);

function SlackMessage({ message = {}, users, emojis, showChannel = false }) {
  const timestamp = message?.ts?.split(".")[0];

  return (
    <>
      <p>
        <b>{_.get(users, [message.user, "real_name"], message.username)}</b>:{" "}
        <span
          style={{ whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{
            __html: domPurify.sanitize(slackMessageParser(message, users, emojis), {
              ALLOW_UNKNOWN_PROTOCOLS: true,
            }),
          }}
        />
      </p>
      {showChannel && (
        <p>
          in{" "}
          <ExternalLink href={`slack://channel?id=${message?.channel?.id}&team=${message.team}`}>
            {_.get(users, [message?.channel?.name, "real_name"], message?.channel?.name)}
          </ExternalLink>{" "}
          | {timestamp && <Time time={new Date(+`${timestamp}000`).toISOString()} />} |{" "}
          <ExternalLink href={message?.permalink}>View in Slack</ExternalLink>
        </p>
      )}
    </>
  );
}

function SlackDetail({ item, users, emojis }) {
  return (
    <div>
      {_.compact([item?.previous_2, item.previous, item]).map((item, i, arr) => {
        const isLast = arr.length - 1 === i;
        return (
          <Card
            key={item.ts}
            style={{
              marginTop: "10px",
              padding: "10px",
              wordBreak: "break-word",
              marginLeft: isLast ? "" : "15px",
            }}
          >
            <SlackMessage message={item} users={users} emojis={emojis} showChannel={isLast} />
          </Card>
        );
      })}
    </div>
  );
}

function getSlackPage(token, searchData, users, emojis) {
  return (wrapper) => ({ offset = 1, withSWR }) => {
    const { data, error } = withSWR(
      useSWR(
        `https://slack.com/api/search.messages?query=${
          searchData.input
        }&token=${token}&count=${pageSize}&page=${offset || 1}`
      )
    );

    if (error) {
      return wrapper({ error, item: null });
    }

    if (!data?.messages?.matches) {
      return wrapper({ item: null });
    }

    return data?.messages?.matches.map((message) =>
      wrapper({
        key: message.ts,
        component: <SlackMessage message={message} users={users} emojis={emojis} showChannel />,
        item: message,
      })
    );
  };
}

export default function SlackSearchResults({ searchData = {}, configuration, searchViewState }) {
  const { token } = configuration.get();

  const [users, setUsers] = React.useState([]);
  const [emojis, setEmojis] = React.useState([]);

  React.useEffect(() => {
    getUsersMemo(token).then((u) => setUsers(u.members));
    getEmojisMemo(token).then((e) => setEmojis(e.emoji));
  }, []);

  const usersById = _.keyBy(users, "id");

  return (
    <PaginatedSearchResults
      searchViewState={searchViewState}
      searchData={searchData}
      logo={logo}
      configuration={configuration}
      computeNextOffset={({ data }) => {
        if (!data?.messages) {
          return null;
        }
        const { page, pages } = data.messages.paging;
        return pages > page ? page + 1 : null;
      }}
      itemDetailRenderer={(item) => (
        <SlackDetail token={token} item={item} users={usersById} emojis={emojis} />
      )}
      pageFunc={getSlackPage(token, searchData, usersById, emojis)}
      deps={[usersById, emojis]}
    />
  );
}
