---
title: "CI with Travis"
---

Travis CI is a hosted CI server which is highly integrated with GitHub. It is really easy to enable Travis for a GitHub project. Hope you all familiar with the Continuous integration. Travis is free for your public repositories. Lets set play with Travis little bit.

<figure>
  <img src="{{ base_path }}/images/post-4-1.jpeg" alt="Travis">
</figure>

What you should have first is a public Repo in GitHub. Then Go to [https://travis-ci.org](https://travis-ci.org) and login using GitHub. Then Travis will display all the public repos you have. Then enable Travis for the repository you want. Now all is set. For each and every commit, travis will build the project now.

For this article I will be working with a docker image and will run unit tests using codeception. You can see the project here,

[https://github.com/Thulana/CICD_ApacheMysql](https://github.com/Thulana/CICD_ApacheMysql)

In this project, I have created a docker image with apache and mysql. What I’m trying to do is, for each commit travis will create the docker container and check if mysql and apache is up and running.

First thing you want to configure travis is .travis.yml file. This file should be there in the root path of your project.

```
language: php

install:
  - docker run -d --name $containername $imagename
  - docker exec $containername service apache2 restart 
script:
  - php codecept.phar run unit

before-script:
env:
  # global will stay the same across all matrix possibilities (will not create additional combinations to run)
  global:
    - imagename=apacheimage
    - containername=apachemysql

notifications: # set notification options
  email:
    recipients:
      - thulanakannangara@gmail.com

    # change is when the repo status goes from pass to fail or vice versa
    on_success: always
    on_failure: always

services:
  - docker

before_install:
  - php --version
  - docker build -t $imagename .
  - sudo apt-get update
  - composer self-update
```

This is the travis.yml file I have created for my project. Here I have selected the language as PHP because I use Codeception for unit testing the container.

Service tag is used to enable services in the travis virtual machine. Here I enable docker, as I use docker to build and run the image. Before install I check for php version and then build the docker image using the imagename provided in env variables. Then run apt-get update to update apt bundle.

Other than that we can even specify type of the Operating system, version and so many other things to customise the build environment. Then the notifications can bet configured. Here I have added 2 email accounts for notification on both failure and success of a build.

We can define environment variables too. Here I have define two env. variables for image and container name. Both these variables are in global scope. It is important when we work with multiple parallel build.

Then In the install step I run the docker image. Once its done, I start the apache2 service by logging into the container. Then In the script step, I run the build command. Here what I do is executing unit tests using codeception. Here I use codecept.phar file as it is easy to work with.

Now all is set here. My dockerfile looks like this.

```
FROM mysql:5.5
MAINTAINER thulana<thulanakannangara@gmail.com>
ENV MYSQL_ROOT_PASSWORD admin
ENV APACHE_RUN_USER www-data
ENV APACHE_RUN_GROUP www-data
ENV APACHE_LOG_DIR /var/log/apache2

RUN apt-get update && apt-get install -y apache2
```

If you don't know how to create unit tests with codeception, It's pretty simple. Follow the Codeception documentation and you will learn it in no time. Once the travis.yml file is pushed into the repo, Travis will start to build the project. If there is a error in tests, build will fail.	

You can see the build results in this [CICD_ApacheMysql](https://travis-ci.org/Thulana/CICD_ApacheMysql) Travis link.  This is just the tip of the Iceberg. We can do so much more with continuous integration with Travis. Thanks.