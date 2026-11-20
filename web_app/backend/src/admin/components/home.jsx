import React from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { useSelector } from "react-redux";

const Home = () => {
  const { email, role } = useSelector((state) => state.session) ?? {};
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
