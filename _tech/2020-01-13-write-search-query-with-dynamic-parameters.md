---
title: "MySQL - write a search query with dynamic parameters"
---

Hey guys,
You would probably think now, what the hell I know this. Yes this is simple, let me show something worth reading for. 

Lets take an example, I have  table named Bill with below attributes.

<figure>
  <img src="{{ base_path }}/images/post1-pic1.PNG" alt="Example table">
</figure>

What if you want to search this table using **ID**, **YEAR** and **CONNECTIONID**. What will be your approach?? 
If i send year = 2016 and connectionId=C001 it should give all the bills in 2016 with connection id C001 and with any ID, as we didn't specify it. we can do this like this.
```sql
SELECT * FROM Bill WHERE year = 2016  and connectionId=C001 ;
```
 

If we use this how can we search with bill ID. This is not working. Even with 3 parameters we can find 7 different searching criteria. if parameters are A ,B, and C

1. A
2. B
3. C
4. AB
5. AC
6. BC
7. ABC

One approach is we identify if parameters are null before hand and switch through all the combinations and define query for each one.
```java
if( connectionID != null and Id = null and year = null){

           SELECT * FROM Bill WHERE  connectionId = ? ;

}else if(connectionID = null and Id != null and year = null){

            SELECT * FROM Bill WHERE id = ? ;

}......................................

```


This is waste of time. Then what we do?? Actually we can write all these in one line. Here is how we do this.

**Step 1 :**

First we define a convention. which is, if one parameter carries null value then we replace it with a negative integer. ( No matter the type of field we can store negative integer and convert it to integer. ) 

**Step 2 :**

Then write the sql query like this.

billID, connectionID and year (underlined) are the variables with the search parameters. They are defined under the above convention. Question marks will be filled out when preparing the statement to stop SQL Injection. (i think you already know this)

```sql
SELECT * FROM  Bill WHERE ("+billID+"<0 or id=?) and ("+connectionID+"<0 or  connectionID=?) and ("+year+"<0 or year=?) ;

```

Lets see how it works,

if one parameter is null ( billID = null ) it carries negative value ( billID = -1) then that condition will be satisfied ( (-1< 0 or id=?)= true). So the search will not use that parameter in search. if parameter is not null  ( billID != null ) then it carries a positive value  ( billID = 123). So the part of the condition will be not be true. ((123 < 0) false ) So condition will only be true if other part is satisfied (id = ?). This is what we wanted right ?

Hope this helps thanks !!!!!!!!!!!!!!!