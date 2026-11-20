import React from "react";
import { Box, H3, Text } from "@adminjs/design-system";

const Home = (props) => {
  const { email, role } = props.data ?? {};
  return (
    <Box variant="white">
      <H3>Welcome to Sahsah Admin</H3>
      <Text mb="lg">
        Signed in as {email} ({role === "super_admin" ? "Super Admin" : "Admin"}).
      </Text>
      <Text>
        Use the menu to open a section. Content, players, shop, messages and public site arrive in later releases. The audit log is
        available now{role === "super_admin" ? ", together with staff management" : ""}.
      </Text>
    </Box>
  );
};

export default Home;
