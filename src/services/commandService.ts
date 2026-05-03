export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    // Social Media Apps
    const socialMatch = lowerCmd.match(/^(open|check)\s+(instagram|twitter|x|facebook|linkedin|github|gmail)$/);
    if (socialMatch) {
      const platform = socialMatch[2];
      let url = "";
      switch (platform) {
        case "instagram": url = "instagram.com"; break;
        case "twitter": case "x": url = "x.com"; break;
        case "facebook": url = "facebook.com"; break;
        case "linkedin": url = "linkedin.com"; break;
        case "github": url = "github.com"; break;
        case "gmail": url = "mail.google.com"; break;
      }
      return {
        action: `Opening ${platform} for you, Boss. Zyada time waste mat karna wahan!`,
        url: `https://www.${url}`,
        isBrowserAction: true,
      };
    }

    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]} for you, Boss. Ek toh kaam karwa liya, khush?`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Post/Tweet action
  const postMatch = lowerCmd.match(/^(post|tweet)\s+(on\s+)?(twitter|x)\s+(.+)$/);
  if (postMatch) {
    const content = encodeURIComponent(postMatch[4].trim());
    return {
      action: `Taiyaar ho jao, Boss! Typing your tweet now.`,
      url: `https://x.com/intent/tweet?text=${content}`,
      isBrowserAction: true,
    };
  }

  // Enhanced Media Search: "Play [song/video]"
  const playGenericMatch = lowerCmd.match(/^play\s+(.+)$/);
  if (playGenericMatch) {
    const fullQuery = playGenericMatch[1].trim();
    
    // Explicit platform checks
    if (fullQuery.toLowerCase().endsWith(" on youtube")) {
      const query = encodeURIComponent(fullQuery.slice(0, -11).trim());
      return {
        action: `Playing ${fullQuery.slice(0, -11)} on YouTube. Bechara YouTube, kya kya jhelna padta hai.`,
        url: `https://www.youtube.com/results?search_query=${query}`,
        isBrowserAction: true,
      };
    }
    
    if (fullQuery.toLowerCase().endsWith(" on spotify")) {
      const query = encodeURIComponent(fullQuery.slice(0, -11).trim());
      return {
        action: `Searching ${fullQuery.slice(0, -11)} on Spotify. Hope it's actually good music.`,
        url: `https://open.spotify.com/search/${query}`,
        isBrowserAction: true,
      };
    }

    // Default to YouTube if "play" is used without platform
    const query = encodeURIComponent(fullQuery);
    return {
      action: `Playing ${fullQuery} on YouTube. Arre wah, taste toh dekho!`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // General Search: "Search for [query]"
  const searchMatch = lowerCmd.match(/^search\s+(for\s+)?(.+)$/);
  if (searchMatch && !lowerCmd.includes("on spotify") && !lowerCmd.includes("on youtube")) {
    const query = encodeURIComponent(searchMatch[2].trim());
    return {
      action: `Searching for ${searchMatch[2]} on Google. Boss, aapko toh sab pata hona chahiye tha!`,
      url: `https://www.google.com/search?q=${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web: "Send a WhatsApp message to [number] saying [message]"
  const waMatch = lowerCmd.match(
    /^send\s+a\s+whatsapp\s+message\s+to\s+([\d\+\s]+)\s+saying\s+(.+)$/,
  );
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending your message. Let's hope they reply.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  return { action: "", isBrowserAction: false };
}
