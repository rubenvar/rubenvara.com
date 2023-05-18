---
title: React Query como gestor de estado
date: 2022-12-29
status: draft
original:
  title: React Query as a State Manager
  url: https://tkdodo.eu/blog/react-query-as-a-state-manager
series:
  name: react-query-tkdodo
  index: 10
---

<script>
  import Box from '$lib/components/Box.svelte';
</script>

React Query is loved by many for drastically simplifying data fetching in React applications. So it might come as a bit of a surprise if I tell you that React Query is in fact *NOT* a data fetching library.

It doesn't fetch any data for you, and only a very small set of features are directly tied to the network (like [the OnlineManager](https://react-query.tanstack.com/reference/onlineManager), `refetchOnReconnect` or [retrying offline mutation](https://react-query.tanstack.com/guides/mutations#retry)). This also becomes apparent when you write your first `queryFn`, and you have to use *something* to actually get the data, like [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), [axios](https://axios-http.com/), [ky](https://github.com/sindresorhus/ky) or even [graphql-request](https://github.com/prisma-labs/graphql-request).

So if React Query is no data fetching library, what is it?

## An Async State Manager

React Query is an async state manager. It can manage any form of asynchronous state - it is happy as long as it gets a Promise. Yes, most of the time, we produce Promises via data fetching, so that's where it shines. But it does more than just handling loading and error states for you. It is a proper, real, "global state manager". The `QueryKey` uniquely identifies your query, so as long you call the query with the same key in two different places, they will get the same data. This can be best abstracted with a custom hook so that we don't have to access the actual data fetching function twice:

```tsx:title=async-state-manager
export const useTodos = () =>
  useQuery({ queryKey: ['todos'], queryFn: fetchTodos })

function ComponentOne() {
  const { data } = useTodos()
}

function ComponentTwo() {
  // ✅ will get exactly the same data as ComponentOne
  const { data } = useTodos()
}

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ComponentOne />
      <ComponentTwo />
    </QueryClientProvider>
  )
}
```

Those components can be *anywhere* in your component tree. As long as they are under the same `QueryClientProvider`, they will get the same data.
React Query will also *deduplicate* requests that would happen at the same time, so in the above scenario, even though two components request the same data, there will be only one network request.

## A data synchronization tool

Because React Query manages async state (or, in terms of data fetching: server state), it assumes that the frontend application doesn't "own" the data. And that's totally right. If we display data on the screen that we fetch from an API, we only display a "snapshot" of that data - the version of how it looked when we retrieved it. So the question we have to ask ourselves is:

Is that data still accurate after we fetch it?

The answer depends totally on our problem domain. If we fetch a Twitter post with all its likes and comments, it is likely outdated (stale) pretty fast. If we fetch exchange rates that update on a daily basis, well, our data is going to be quite accurate for some time even without refetching.

React Query provides the means to *synchronize* our view with the actual data owner - the backend. And by doing so, it errs on the side of updating often rather than not updating often enough.

### Before React Query

Two approaches to data fetching were pretty common before libraries like React Query came to the rescue:

- fetch once, distribute globally, rarely update<br />
  This is pretty much what I myself have been doing with redux a lot. Somewhere, I dispatch an action that initiates the data fetching, usually on mount of the application. After we get the data, we put it in a global state manager so that we can access it everywhere in our application. After all, many components need access to our Todo list.
  Do we refetch that data? No, we have "downloaded" it, so we have it already, why should we? Maybe if we fire a POST request to the backend, it will be kind enough to give us the "latest" state back. If you want something more accurate, you can always reload your browser window...

- fetch on every mount, keep it local<br />
  Sometimes, we might also think that putting data in global state is "too much". We only need it in this Modal Dialog, so why not fetch it *just in time* when the Dialog opens. You know the drill: `useEffect`, empty dependency array (throw an eslint-disable at it if it screams), `setLoading(true)` and so on ... Of course, we now show a loading spinner every time the Dialog opens until we have the data. What else can we do, the local state is gone...

---

Both of these approaches are pretty sub-optimal. The first one doesn't update our local cache often enough, while the second one potentially re-fetches too often, and also has a questionable ux because data is not there when we fetch for the second time.

So how does React Query approach these problems?

### Stale While Revalidate

You might have heard this before, it's the caching mechanism that React Query uses. It's nothing new - you can read about the [HTTP Cache-Control Extensions for Stale Content here](https://datatracker.ietf.org/doc/html/rfc5861). In summary, it means React Query will cache data for you and give it to you when you need it, even if that data might not be up-to-date (stale) anymore. The principle is that stale data is better than no data, because no data usually means a loading spinner, and this will be perceived as "slow" by users. At the same time, it will try to perform a background refetch to revalidate that data.

### Smart refetches

Cache invalidation is pretty hard, so when do you decide it's time to ask the backend again for new data? Surely we can't just do this every time a component that calls `useQuery` re-renders. That would be insanely expensive, even by modern standards.

So React Query is being smart and chooses strategic points for triggering a refetch. Points that seem to be a good indicator for saying: "Yep, now would be a good time to go get some data". These are:

- `refetchOnMount`<br />
  Whenever a new component that calls `useQuery` mounts, React Query will do a
  revalidation.

- `refetchOnWindowFocus`<br />
  Whenever you focus the browser tab, there will be a refetch. This is my favourite point in time to do a revalidation, but it's often misunderstood. During development, we switch browser tabs very often, so we might perceive this as "too much". In production however, it most likely indicates that a user who left our app open in a tab now comes back from checking mails or reading twitter. Showing them the latest updates makes perfect sense in this situation.

- `refetchOnReconnect`<br />
  If you lose your network connection and regain it, it's also a good indicator to revalidate what you see on the screen.

Finally, if you, as the developer of your app, know a good point in time, you can invoke a manual invalidation via `queryClient.invalidateQueries`. This comes in very handy after you perform a mutation.

### Letting React Query do its magic

I love [these defaults](https://react-query.tanstack.com/guides/important-defaults), but as I said before, they are geared towards keeping things up-to-date, *not* to minimize the amount of network requests. This is mainly because `staleTime` defaults to *zero*, which means that every time you e.g. mount a new component instance, you will get a background refetch. If you do this a lot, especially with mounts in short succession that are not in the same render cycle, you might see *a lot* of fetches in the network tab. That's because React Query can't deduplicate in such situations:

```tsx:title=mounts-in-short-succession
function ComponentOne() {
  const { data } = useTodos()

  if (data) {
    // ⚠️ mounts conditionally, only after we already have data
    return <ComponentTwo />
  }
  return <Loading />
}

function ComponentTwo() {
  // ⚠️ will thus trigger a second network request
  const { data } = useTodos()
}

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ComponentOne />
    </QueryClientProvider>
  )
}
```

> What's going on here, I just fetched my data 2 seconds ago, why is there another network request happening? This is insane!

<p style="padding-left: 3rem; margin-top: -1rem">
  — Legit reaction when using React Query for the first time
</p>

At that point, it might seem like a good idea to either pass `data` down via props, or to put it in `React Context` to avoid prop drilling, or to just turn off the `refetchOnMount` / `refetchOnWindowFocus` flags because all of this fetching is just too much!

Generally, there is nothing wrong with passing data as props. It's the most explicit thing you can do, and would work well in the above example. But what if we tweak the example a bit towards a more real-life situation:

```tsx:title=lazy-second-component
function ComponentOne() {
  const { data } = useTodos()
  const [showMore, toggleShowMore] = React.useReducer(
    (value) => !value,
    false
  )

  // yes, I leave out error handling, this is "just" an example
  if (!data) {
    return <Loading />
  }

  return (
    <div>
      Todo count: {data.length}
      <button onClick={toggleShowMore}>Show More</button>
      // ✅ show ComponentTwo after the button has been clicked
      {showMore ? <ComponentTwo /> : null}
    </div>
  )
}
```

In this example, our second component (which also depends on the todo data) will only mount after the user clicks a button. Now imagine our user clicks on that button after some minutes. Wouldn't a background refetch be nice in that situation, so that we can see the up-to-date values of our todo list?

This wouldn't be possible if you chose any of the aforementioned approaches that basically bypass what React Query wants to do.

So how can we have our cake and eat it, too?

### Customize *staleTime*

Maybe you've already guessed the direction in which I want to go: The solution would be to set `staleTime` to a value you are comfortable with for your specific use-case. The key thing to know is:

<Box>
  As long as data is fresh, it will always come from the cache only. You will
  not see a network request for fresh data, no matter how often you want to
  retrieve it.
</Box>

There is also no "correct" value for `staleTime`. In many situations, the defaults work really well. Personally, I like to set it to a minimum of 20 seconds to deduplicate requests in that time frame, but it's totally up to you.

#### Bonus: using setQueryDefaults

Since v3, React Query supports a great way of setting default values per Query Key via [QueryClient.setQueryDefaults](https://react-query.tanstack.com/reference/QueryClient#queryclientsetquerydefaults). So if you follow the patterns I've outlined in [#8: Effective React Query Keys](effective-react-query-keys), you can set defaults for any granularity you want, because passing Query Keys to `setQueryDefaults` follows the standard partial matching that e.g. [Query Filters](https://react-query.tanstack.com/guides/filters#query-filters) also have:

```tsx:title=setQueryDefaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✅ globally default to 20 seconds
      staleTime: 1000 * 20,
    },
  },
})

// 🚀 everything todo-related will have a 1 minute staleTime
queryClient.setQueryDefaults(todoKeys.all, { staleTime: 1000 * 60 })
```

## A note on separation of concerns

It is a seemingly legit concern that adding hooks like `useQuery` to components of all layers in your app mixes responsibilities of what a component should do. Back in the *old days*, the "smart-vs-dumb", "container-vs-presentational" component pattern was ubiquitous. It promised clear separation, decoupling, reusability and ease of testability because presentational components would just "get props". It also led to lots of prop drilling, boilerplate, patterns that were hard to statically type (👋 higher-order-components) and arbitrary component splits.

That changed a lot when hooks came around. You can now `useContext`, `useQuery` or `useSelector` (if you're using redux) everywhere, and thus inject dependencies into your component. You can argue that doing so makes your component more coupled. You can also say that it's now more independent because you can move it around freely in your app, and it will just work on its own.

I can totally recommend watching [Hooks, HOCS, and Tradeoffs (⚡️) / React Boston 2019](https://www.youtube.com/watch?v=xiKMbmDv-Vw) by redux maintainer [Mark Erikson](https://twitter.com/acemarke).

In summary, it's all tradeoffs. There is no free lunch. What might work in one situation might not work in others. Should a reusable `Button` component do data fetching? Probably not. Does it make sense to split your `Dashboard` into a `DashboardView` and a `DashboardContainer` that passes data down? Also, probably not. So it's on us to know the tradeoffs and apply the right tool for the right job.

## Takeaways

React Query is great at managing async state globally in your app, if you let it. Only turn off the refetch flags if you know that make sense for your use-case, and resist the urge to sync server data to a different state manager. Usually, customizing `staleTime` is all you need to get a great ux while also being in control of how often background updates happen.
