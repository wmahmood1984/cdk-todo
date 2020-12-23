import fetch from 'cross-fetch'
import { ApolloClient, InMemoryCache,HttpLink } from '@apollo/client';

export const client = new ApolloClient({
    link: new HttpLink({
        uri: 'https://fbbmocusy5dgng6elseajuggt4.appsync-api.eu-west-1.amazonaws.com/graphql',
       fetch, 
       headers: {
        "x-api-key": "da2-nuo2pxnjdjf2pdm3krclbqbd3i", // ENTER YOUR API KEY HERE
      },
    }),
    cache: new InMemoryCache()
});