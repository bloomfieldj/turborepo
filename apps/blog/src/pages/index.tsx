/* eslint-disable react/no-array-index-key */
import { NextPage } from 'next';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { InferQueryPathAndInput, trpc } from '@/lib/trpc';
import { PostSummaryProps } from '@/components/molecules/PostSummary';
import { getQueryPaginationInput, Pagination } from '@/components/molecules/Pagination';
import PostSummarySkeleton from '@/components/atoms/Skeletons/PostSummarySkeleton';

const POSTS_PER_PAGE = 20;

const PostSummary = dynamic<PostSummaryProps>(
  () => import('@/components/molecules/PostSummary').then(mod => mod.PostSummary),
  { ssr: false },
);

const Home: NextPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const currentPageNumber = router.query.page ? Number(router.query.page) : 1;
  const utils = trpc.useContext();
  const feedQueryPathAndInput: InferQueryPathAndInput<'post.feed'> = [
    'post.feed',
    getQueryPaginationInput(POSTS_PER_PAGE, currentPageNumber),
  ];
  const feedQuery = trpc.useQuery(feedQueryPathAndInput);
  const likeMutation = trpc.useMutation(['post.like'], {
    onMutate: async likedPostId => {
      await utils.cancelQuery(feedQueryPathAndInput);

      const previousQuery = utils.getQueryData(feedQueryPathAndInput);

      if (previousQuery) {
        utils.setQueryData(feedQueryPathAndInput, {
          ...previousQuery,
          posts: previousQuery.posts.map(post =>
            post.id === likedPostId
              ? {
                  ...post,
                  likedBy: [
                    ...post.likedBy,
                    {
                      user: { id: session!.user.id, name: session!.user.name },
                    },
                  ],
                }
              : post,
          ),
        });
      }

      return { previousQuery };
    },
    onError: (err, id, context: any) => {
      if (context?.previousQuery) {
        utils.setQueryData(feedQueryPathAndInput, context.previousQuery);
      }
    },
  });
  const unlikeMutation = trpc.useMutation(['post.unlike'], {
    onMutate: async unlikedPostId => {
      await utils.cancelQuery(feedQueryPathAndInput);

      const previousQuery = utils.getQueryData(feedQueryPathAndInput);

      if (previousQuery) {
        utils.setQueryData(feedQueryPathAndInput, {
          ...previousQuery,
          posts: previousQuery.posts.map(post =>
            post.id === unlikedPostId
              ? {
                  ...post,
                  likedBy: post.likedBy.filter(item => item.user.id !== session!.user.id),
                }
              : post,
          ),
        });
      }

      return { previousQuery };
    },
    onError: (err, id, context: any) => {
      if (context?.previousQuery) {
        utils.setQueryData(feedQueryPathAndInput, context.previousQuery);
      }
    },
  });

  if (feedQuery.data) {
    return (
      <>
        <Head>
          <title>The BLACC Blog</title>
        </Head>

        <h1 className="mt-6 mb-12 text-4xl font-black text-white md:text-5xl">The BLACC Blog</h1>
        {feedQuery.data.postCount === 0 ? (
          <div className="text-secondary rounded border py-20 px-10 text-center">
            There are no published posts to show yet.
          </div>
        ) : (
          <div className="flow-root">
            <ul className="divide-primary divide-y divide-[#424242]">
              {feedQuery.data.posts?.map(post => (
                <li key={post.id} className="py-9">
                  <PostSummary
                    post={post}
                    onLike={() => {
                      likeMutation.mutate(post.id);
                    }}
                    onUnlike={() => {
                      unlikeMutation.mutate(post.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <Pagination
          itemCount={feedQuery.data.postCount}
          itemsPerPage={POSTS_PER_PAGE}
          currentPageNumber={currentPageNumber}
        />
      </>
    );
  }

  if (feedQuery.isError) {
    return <div>Error: {feedQuery.error.message}</div>;
  }

  return (
    <div className="flow-root">
      <ul className="divide-primary -my-12 divide-y">
        {[...Array(3)].map((_, idx) => (
          <li key={idx} className="py-10">
            <PostSummarySkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
