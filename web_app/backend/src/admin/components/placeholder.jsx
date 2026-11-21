import React, { useEffect, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { ApiClient } from "adminjs";
import { useParams } from "react-router";

const Placeholder = () => {
  const { pageName } = useParams();
  const [info, setInfo] = useState(null);
  useEffect(() => {
    setInfo(null);
    new ApiClient().getPage({ pageName }).then((response) => setInfo(response.data));
  }, [pageName]);
  return (
    <Box variant="white">
      <H3>{info?.title ?? ""}</H3>
      <Text>This section arrives in a later release{info ? `: ${info.planned.toLowerCase()}` : ""}. Nothing here can be changed yet.</Text>
    </Box>
  );
};

export default Placeholder;
