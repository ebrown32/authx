import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLBoolean,
  GraphQLInputObjectType
} from "graphql";

export const GraphQLCreateClientInput = new GraphQLInputObjectType({
  name: "CreateClientInput",
  fields: () => ({
    enabled: {
      type: GraphQLBoolean,
      defaultValue: true
    },
    name: {
      type: new GraphQLNonNull(GraphQLString)
    },
    description: {
      type: new GraphQLNonNull(GraphQLString)
    },
    urls: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      )
    },
    userIds: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID)))
    }
  })
});
