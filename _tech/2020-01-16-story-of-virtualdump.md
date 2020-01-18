---
title: "How to create your own blog with zero cost - Story of virtualdump"
---

Who won't like your own blog in your own domain. But to do all this you needs to do spent few bucks. If not you can go with a popular blogging site like **Medium**.  But every techie would love their own space. So, here is the story of  [Virtual Dump](http://virtualdump.tk/)

What you will need,
- GitHub account -  [Sign up](https://github.com/)
- FreeNom account - [Sign up](https://my.freenom.com/)
- Cloud-flare account - [Sign up](https://www.cloudflare.com/) 
- Precious time of yours :stuck_out_tongue_winking_eye:

FYI this is a high level walk-through about how to get it up and running, i will share all the resources, you have to do it your own. Add a little touch of yours to it, don't do what everyone does. 

First things First, lets get your blog up and running locally before we move into deploying etc.

## Build your static site
I'm gonna use GitHub pages to make my static website. You can build your site from ground up by doing everything manually by writing HTML, CSS and JavaScript. But it will take forever, You don't need that. One of the first principles of programming is **Code Re-usability**.  Which means, you don't need to write something which is already there. Just use the damn thing. So lets talk about the frameworks you can use with GitHub pages.  
There are so many static site generators but there is one which is backed by GitHub itself, [jekyll](https://jekyllrb.com/). It uses cool templating  language [Liquid](https://jekyllrb.com/docs/liquid/) which will gonna make your life so much easier. There is two approaches you can take,

 - Build the site with a fresh jekyll project - Good approach, lot to learn 
 - Be a smuch like me and use a free jekyll theme and customize - Easy though

So I'm gonna go with the shortcut here.  Here is a good collection of themes [http://jekyllthemes.org](http://jekyllthemes.org/) where you can choose one for yourself.  I went with [mmistakes](https://mmistakes.github.io/) . Thanks [Michael Rose](https://twitter.com/mmistakes) for this cool theme. So lemme clear up, why using a theme is really easy.

 - No needs to do the ground work such as headers, footers and page configurations as they are already done.
 - No needs to worry about Facebook commenting, post sharing, Google analytics, google adsense, basically most of the config stuff that will take days to implement. 

So what you have to do is clone such repo and configure as you want. Once you are done, you have to push it to github. Before do that log on to GitHub and create a GitHub page repository.  You can learn how to do that here [https://pages.github.com/](https://pages.github.com/). It's same as creating a usual GitHub repository. Only difference is repository name should be in the format of *username.github.io*. Once you have done that inside your local website folder, change the git remote origin like this,

`
git remote set-url origin git@github.com:USERNAME/REPOSITORY.git
`

Once you have done that commit all the changes and push to the origin. Then go to http://username.github.io/ and you will see that your static site is up and running.  :satisfied:

Let's move on to next phase.

##  Add a Cool domain

As we are going to do everything without wasting a penny, then we must find a free domain provider.  **TK** domains are free but not for long. You can use them for sometime, but when the traffic increases, they tends to pull the plug. :grimacing: Everything in life comes with a price. Anyway lets get this up with a semi-free domain. 

What you have to do is go to [FreeNom](https://my.freenom.com/) and create a account if you don't have one already. After that you can search for the domain and buy it for free. After that you have to route the traffic through this domain to your gh page. As you may already know this process is called **domain name resolution**. What we do here is we add the Domian  -----> gh page mapping to known name servers. Then when we search the domain it will resolved by the name servers to the gh page url. As we are referring our gh page using the URL, we call this CNAME record. Enough of this side talk, lets do this.