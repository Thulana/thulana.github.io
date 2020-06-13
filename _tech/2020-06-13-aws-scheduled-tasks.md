---
title: "Reduce your cloud infrastructure costs by using Scheduled Tasks on AWS by Damian Perera"

---

ECS allows you to deploy and run containers on a fully-managed orchestration service (similar to Kubernetes). While the most common use case of ECS (as far as I know) is to continuously run services on containers, there could be some architectural designs that require some services to only run periodically.

<figure>
  <img src="{{ base_path }}/images/post6-1.jpeg" alt="aws">
</figure>

One way to achieve this would be to add a cron job to the Dockerfile of the container in order to start the service periodically (while running the cron daemon in the foreground). The drawback of this would be that you would have a container with a service that needs to run only x minutes per day but would be continuously reserving (and therefore being billed for) the resources of an ECS instance.

<figure>
  <img src="{{ base_path }}/images/post6-2.png" alt="dockerfile with cron">
</figure>

While this certainly is easy and would not require you to change your deployment code, the infrastructure cost that you would incur alone would outweigh any perceived drawbacks of switching over to a Scheduled Task.

## But why should I switch over to a Scheduled Task?

The beauty of this method is that it will spin up the container when you need it to (based on a [cron](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html#CronExpressions) or [rate](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html#RateExpressions) expression) and automatically destroy itself once the service ends its main process.

Here are a few scenarios where you might consider using an ECS Scheduled Task over a normal ECS Task:

- Extract, Transform, Load (ETL) services that periodically fetch data from services or databases with varying execution times.

- Application health monitoring services that periodically execute integration tests to make sure that mission-critical systems and associated third-party services are behaving as expected, again with varying execution times.

- Scheduled services with an execution time greater than 15 minutes, which cannot be accommodated within the time restrictions of a serverless offering such as on AWS Lambda.

## So how does a Scheduled Task work?

Basically what happens is that the responsibility of starting a container is delegated from ECS to CloudWatch, while ECS continues to manage the container over its lifecycle once it has started.

<figure>
  <img src="{{ base_path }}/images/post6-3.png" alt="scheduled task flow">
</figure>

A Scheduled Task uses EventBridge (a serverless pub/sub service leveraging the CloudWatch Events API) to create an event rule on CloudWatch which then waits to be triggered by an associated cron or rate expression after which the target ECS task is invoked.

Note that the relevant service needs to exit its main process once it completes its execution in order to allow the AWS ECS Container Agent to gracefully shut it down.

## Enough reading, start deploying!

The following is a ready-to-deploy template that can be used to create a Scheduled Task using CloudFormation and assumes (as in most scenarios) that you already have the following resources in place:

- An ECS cluster

- A container repository (e.g. ECR or Docker Hub)

- An IAM role with a policy that grants permission to the CloudWatch Events API to run tasks on ECS

```json

{
  "Description": "AWS CloudFormation Boilerplate Template for an ECS Scheduled Task",
  "Parameters": {
    "Tag": {
      "Type": "String",
      "Default": "latest"
    },
    "Repository": {
      "Type": "String"
    },
    "ClusterName": {
      "Type": "String",
      "Default": "Demo-Cluster"
    },
    "DesiredCapacity": {
      "Type": "Number",
      "Default": 1
    },
    "Memory": {
      "Type": "Number",
      "Default": 512
    },
    "IAMRole": {
      "Type": "String",
      "Default": "SuperUser",
    },
    "Cron": {
      "Type" : "String",
      "Default" : "cron(/30 * * * * *)"
    }
  },
  "Resources": {
    "TaskDefinition": {
      "Type": "AWS::ECS::TaskDefinition",
      "Properties": {
        "Family": {
          "Fn::Sub": "${AWS::StackName}"
        },
        "ContainerDefinitions": [
          {
            "Name": {
              "Fn::Sub": "${AWS::StackName}"
            },
            "Image": {
              "Fn::Sub": "${Repository}:${Tag}"
            },
            "Essential": true,
            "Memory": {
              "Ref": "Memory"
            },
            "PortMappings": [
              {
                "ContainerPort": 80
              }
            ],
            "LogConfiguration": {
              "LogDriver": "awslogs",
              "Options": {
                "awslogs-group": "scheduled-task",
                "awslogs-region": "us-east-1",
                "awslogs-stream-prefix": "demo"
              }
            }
          }
        ]
      }
    },
    "TaskSchedule": {
      "Type": "AWS::Events::Rule",
      "Properties": {
        "Description": "Runs an ECS service according to a schedule",
        "Name": "Demo-Scheduled-Task",
        "ScheduleExpression": {
          "Ref": "Cron"
        },
        "State": "ENABLED",
        "Targets": [
          {
            "Id": "Demo-ECS-Task-Schedule",
            "RoleArn": {
              "Fn::Join": [
                "/", [
                  {
                    "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role"
                  },
                  {
                    "Ref": "IAMRole"
                  }
                ]
              ]
            },
            "EcsParameters": {
              "TaskDefinitionArn": {
                "Ref": "TaskDefinition"
              },
              "TaskCount": {
                "Ref": "DesiredCapacity"
              }
            },
            "Arn": {
              "Fn::Join": [
                "/", [
                  {
                    "Fn::Sub": "arn:aws:ecs:${AWS::Region}:${AWS::AccountId}:cluster"
                  },
                  {
                    "Ref": "ClusterName"
                  }
                ]
              ]
            }
          }
        ]
      }
    }
  }
}

```

Don't forget to visit damian's medium page for new cool articles,

Medium : [Damian Perera](https://medium.com/@damianperera)