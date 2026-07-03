import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

dns.resolveSrv(
  "_mongodb._tcp.cluster01.wmts014.mongodb.net",
  (err, addresses) => {
    if (err) {
      console.log("DNS Error:", err);
    } else {
      console.log("MongoDB SRV:", addresses);
    }
  }
);